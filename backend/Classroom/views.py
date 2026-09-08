from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from EduEssence.backend.Auth.permissions import IsStudent, IsTeacher
from EduEssence.backend.Auth.serializers import MessageSerializer
from EduEssence.backend.Classroom.livekit import (
    LiveKitNotConfigured,
    build_room_name,
    create_access_token,
)
from EduEssence.backend.Classroom.models import ClassParticipant, LiveClass, UtteranceTranslation
from EduEssence.backend.Classroom.pipeline import (
    EmptyTranscript,
    NoListeners,
    process_class_utterance,
)
from EduEssence.backend.Classroom.serializers import (
    ClassUtteranceRequestSerializer,
    ClassUtteranceSerializer,
    JoinClassSerializer,
    LanguageChangeSerializer,
    LiveClassDetailSerializer,
    LiveClassSerializer,
    ParticipantSerializer,
    RoomTokenSerializer,
    StreamSerializer,
)
from EduEssence.backend.Translation.providers import ProviderError


def teacher_class(request, class_id):
    return get_object_or_404(LiveClass, id=class_id, teacher=request.user)


def visible_class(request, class_id):
    live_class = get_object_or_404(LiveClass, id=class_id)

    if live_class.teacher_id == request.user.id:
        return live_class

    get_object_or_404(ClassParticipant, live_class=live_class, student=request.user)
    return live_class


class ClassListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    serializer_class = LiveClassSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='List the classes owned by the teacher',
        responses={200: LiveClassSerializer(many=True)},
    )
    def get(self, request):
        classes = LiveClass.objects.filter(teacher=request.user)
        serializer = self.serializer_class(classes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Online Classroom'],
        summary='Create a class and receive its join code',
        request=LiveClassSerializer,
        responses={201: LiveClassSerializer},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(teacher=request.user, room_name=build_room_name())
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClassDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LiveClassDetailSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Retrieve a class with its participants',
        responses={200: LiveClassDetailSerializer},
    )
    def get(self, request, class_id):
        live_class = visible_class(request, class_id)
        serializer = self.serializer_class(live_class)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClassStartView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    serializer_class = LiveClassSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Open the class so students can join',
        request=None,
        responses={200: LiveClassSerializer},
    )
    def post(self, request, class_id):
        live_class = teacher_class(request, class_id)

        if live_class.is_ended:
            return Response(
                {'detail': 'This class has already ended.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not live_class.is_live:
            live_class.status = LiveClass.Status.LIVE
            live_class.started_at = timezone.now()
            live_class.save(update_fields=['status', 'started_at'])

        return Response(self.serializer_class(live_class).data, status=status.HTTP_200_OK)


class ClassEndView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    serializer_class = LiveClassSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='End the class',
        request=None,
        responses={200: LiveClassSerializer},
    )
    def post(self, request, class_id):
        live_class = teacher_class(request, class_id)

        if not live_class.is_ended:
            live_class.status = LiveClass.Status.ENDED
            live_class.ended_at = timezone.now()
            live_class.save(update_fields=['status', 'ended_at'])
            live_class.participants.filter(left_at__isnull=True).update(left_at=timezone.now())

        return Response(self.serializer_class(live_class).data, status=status.HTTP_200_OK)


class ClassJoinView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = JoinClassSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Join a class with its code and pick a listening language',
        request=JoinClassSerializer,
        responses={200: ParticipantSerializer, 404: MessageSerializer},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        live_class = get_object_or_404(LiveClass, join_code=data['join_code'])

        if live_class.is_ended:
            return Response(
                {'detail': 'This class has already ended.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant, _ = ClassParticipant.objects.update_or_create(
            live_class=live_class,
            student=request.user,
            defaults={'target_language': data['target_language'], 'left_at': None},
        )

        payload = ParticipantSerializer(participant).data
        payload['class_id'] = live_class.id
        payload['room_name'] = live_class.room_name
        return Response(payload, status=status.HTTP_200_OK)


class ClassLeaveView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = MessageSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Leave a class',
        request=None,
        responses={200: MessageSerializer},
    )
    def post(self, request, class_id):
        participant = get_object_or_404(
            ClassParticipant,
            live_class_id=class_id,
            student=request.user,
        )

        if participant.is_active:
            participant.left_at = timezone.now()
            participant.save(update_fields=['left_at'])

        return Response({'detail': 'You have left the class.'}, status=status.HTTP_200_OK)


class ClassLanguageView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = LanguageChangeSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Change the language the student listens in',
        request=LanguageChangeSerializer,
        responses={200: ParticipantSerializer},
    )
    def post(self, request, class_id):
        participant = get_object_or_404(
            ClassParticipant,
            live_class_id=class_id,
            student=request.user,
            left_at__isnull=True,
        )

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        participant.target_language = serializer.validated_data['target_language']
        participant.save(update_fields=['target_language'])

        return Response(ParticipantSerializer(participant).data, status=status.HTTP_200_OK)


class RoomTokenView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RoomTokenSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Mint a LiveKit token for the video and voice call',
        request=None,
        responses={200: RoomTokenSerializer, 503: MessageSerializer},
    )
    def get(self, request, class_id):
        live_class = visible_class(request, class_id)

        if live_class.is_ended:
            return Response(
                {'detail': 'This class has already ended.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identity = f'user-{request.user.id}'

        try:
            token = create_access_token(
                room_name=live_class.room_name,
                identity=identity,
                display_name=request.user.full_name or request.user.username,
                can_publish=True,
            )
        except LiveKitNotConfigured as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        payload = self.serializer_class(
            {
                'token': token,
                'url': settings.LIVEKIT_URL,
                'room_name': live_class.room_name,
                'identity': identity,
                'can_publish': True,
            }
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class ClassUtteranceView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ClassUtteranceRequestSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Translate one utterance into every language the class is listening in',
        request={'multipart/form-data': ClassUtteranceRequestSerializer},
        responses={
            200: ClassUtteranceSerializer,
            204: None,
            503: MessageSerializer,
        },
    )
    def post(self, request, class_id):
        live_class = teacher_class(request, class_id)

        if not live_class.is_live:
            return Response(
                {'detail': 'Start the class before sending audio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        audio = serializer.validated_data['audio']

        if audio.size > settings.MAX_UTTERANCE_BYTES:
            return Response(
                {'detail': 'The audio chunk is too large. Send shorter utterances.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        try:
            utterance = process_class_utterance(
                live_class,
                audio.read(),
                audio.name or 'utterance.webm',
                speak=serializer.validated_data['speak'],
            )
        except NoListeners:
            return Response(
                {'detail': 'No student is listening in another language yet.'},
                status=status.HTTP_409_CONFLICT,
            )
        except EmptyTranscript:
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProviderError as error:
            return Response(
                {'detail': f'Speech pipeline unavailable. {error.message}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = ClassUtteranceSerializer(utterance).data
        return Response(payload, status=status.HTTP_200_OK)


class ClassStreamView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StreamSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Poll for new translated speech in the caller language',
        parameters=[
            OpenApiParameter(
                name='after',
                type=int,
                description='Last sequence already received. Start at 0.',
            )
        ],
        responses={200: StreamSerializer},
    )
    def get(self, request, class_id):
        live_class = visible_class(request, class_id)

        if live_class.teacher_id == request.user.id:
            target_language = live_class.source_language
        else:
            participant = get_object_or_404(
                ClassParticipant,
                live_class=live_class,
                student=request.user,
            )
            target_language = participant.target_language

        try:
            after = int(request.query_params.get('after', 0))
        except ValueError:
            after = 0

        translations = (
            UtteranceTranslation.objects.filter(
                utterance__live_class=live_class,
                utterance__sequence__gt=after,
                target_language=target_language,
            )
            .select_related('utterance')
            .order_by('utterance__sequence')[: settings.CLASS_STREAM_PAGE_SIZE]
        )

        items = [
            {
                'sequence': translation.utterance.sequence,
                'original_text': translation.utterance.original_text,
                'translated_text': translation.translated_text,
                'target_language': translation.target_language,
                'audio_base64': translation.audio_base64,
                'audio_format': translation.audio_format,
                'created_at': translation.utterance.created_at,
            }
            for translation in translations
        ]

        payload = self.serializer_class(
            {
                'cursor': items[-1]['sequence'] if items else after,
                'target_language': target_language,
                'items': items,
            }
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class ClassTranscriptView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClassUtteranceSerializer

    @extend_schema(
        tags=['Online Classroom'],
        summary='Read the full class transcript with every translation',
        responses={200: ClassUtteranceSerializer(many=True)},
    )
    def get(self, request, class_id):
        live_class = visible_class(request, class_id)
        utterances = live_class.utterances.prefetch_related('translations')
        serializer = self.serializer_class(utterances, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
