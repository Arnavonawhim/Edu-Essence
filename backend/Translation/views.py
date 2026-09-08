from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Auth.serializers import MessageSerializer
from Translation.languages import LANGUAGES
from Translation.models import TeachingSession
from Translation.pipeline import EmptyTranscript, process_utterance
from Translation.providers import ProviderError, text_to_speech, translate_text
from Translation.serializers import (
    LanguageSerializer,
    SpeechRequestSerializer,
    SpeechResponseSerializer,
    TeachingSessionDetailSerializer,
    TeachingSessionSerializer,
    TextTranslationRequestSerializer,
    TextTranslationResponseSerializer,
    UtteranceRequestSerializer,
    UtteranceResponseSerializer,
)


class LanguageListView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LanguageSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='List the supported languages',
        responses={200: LanguageSerializer(many=True)},
    )
    def get(self, request):
        languages = [
            {
                'code': code,
                'name': config['name'],
                'native_name': config['native_name'],
            }
            for code, config in LANGUAGES.items()
        ]
        return Response(languages, status=status.HTTP_200_OK)


class SessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeachingSessionSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='List the sessions owned by the current user',
        responses={200: TeachingSessionSerializer(many=True)},
    )
    def get(self, request):
        sessions = TeachingSession.objects.filter(owner=request.user)
        serializer = self.serializer_class(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Live Translation'],
        summary='Start a teaching session',
        request=TeachingSessionSerializer,
        responses={201: TeachingSessionSerializer},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SessionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeachingSessionDetailSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='Retrieve a session with its transcript',
        responses={200: TeachingSessionDetailSerializer},
    )
    def get(self, request, session_id):
        session = get_object_or_404(
            TeachingSession.objects.prefetch_related('chunks'),
            id=session_id,
            owner=request.user,
        )
        serializer = self.serializer_class(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionEndView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeachingSessionSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='End a teaching session',
        request=None,
        responses={200: TeachingSessionSerializer},
    )
    def post(self, request, session_id):
        session = get_object_or_404(TeachingSession, id=session_id, owner=request.user)

        if session.is_live:
            session.status = TeachingSession.Status.ENDED
            session.ended_at = timezone.now()
            session.save(update_fields=['status', 'ended_at'])

        serializer = self.serializer_class(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UtteranceView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = UtteranceRequestSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='Transcribe, translate and speak one utterance',
        request={'multipart/form-data': UtteranceRequestSerializer},
        responses={
            200: UtteranceResponseSerializer,
            204: None,
            503: MessageSerializer,
        },
    )
    def post(self, request, session_id):
        session = get_object_or_404(TeachingSession, id=session_id, owner=request.user)

        if not session.is_live:
            return Response(
                {'detail': 'This session has already ended.'},
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
            chunk, audio_base64, audio_format = process_utterance(
                session,
                audio.read(),
                audio.name or 'utterance.webm',
                speak=serializer.validated_data['speak'],
            )
        except EmptyTranscript:
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProviderError as error:
            return Response(
                {'detail': f'Speech pipeline unavailable. {error.message}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = UtteranceResponseSerializer(
            {
                'chunk': chunk,
                'audio_base64': audio_base64,
                'audio_format': audio_format,
            }
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class TextTranslationView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TextTranslationRequestSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='Translate text without audio',
        request=TextTranslationRequestSerializer,
        responses={200: TextTranslationResponseSerializer, 503: MessageSerializer},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            translated_text, provider = translate_text(
                data['text'],
                data['source_language'],
                data['target_language'],
            )
        except ProviderError as error:
            return Response(
                {'detail': f'Translation unavailable. {error.message}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = TextTranslationResponseSerializer(
            {
                'original_text': data['text'],
                'translated_text': translated_text,
                'provider': provider,
            }
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class SpeechView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SpeechRequestSerializer

    @extend_schema(
        tags=['Live Translation'],
        summary='Synthesise speech for the 3D teacher',
        request=SpeechRequestSerializer,
        responses={200: SpeechResponseSerializer, 503: MessageSerializer},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            (audio_base64, audio_format), provider = text_to_speech(
                data['text'],
                data['language'],
            )
        except ProviderError as error:
            return Response(
                {'detail': f'Speech synthesis unavailable. {error.message}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = SpeechResponseSerializer(
            {
                'audio_base64': audio_base64,
                'audio_format': audio_format,
                'provider': provider,
            }
        ).data
        return Response(payload, status=status.HTTP_200_OK)
