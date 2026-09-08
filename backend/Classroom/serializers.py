from rest_framework import serializers

from EduEssence.backend.Classroom.models import (
    ClassParticipant,
    ClassUtterance,
    LiveClass,
    UtteranceTranslation,
)
from EduEssence.backend.Translation.serializers import LanguageCodeField


class ParticipantSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_email = serializers.EmailField(source='student.email', read_only=True)

    class Meta:
        model = ClassParticipant
        fields = [
            'id',
            'student_name',
            'student_email',
            'target_language',
            'joined_at',
            'left_at',
        ]
        read_only_fields = fields


class LiveClassSerializer(serializers.ModelSerializer):
    source_language = LanguageCodeField()
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    participant_count = serializers.SerializerMethodField()
    target_languages = serializers.SerializerMethodField()

    class Meta:
        model = LiveClass
        fields = [
            'id',
            'title',
            'subject',
            'topic',
            'source_language',
            'join_code',
            'room_name',
            'status',
            'teacher_name',
            'participant_count',
            'target_languages',
            'created_at',
            'started_at',
            'ended_at',
        ]
        read_only_fields = [
            'id',
            'join_code',
            'room_name',
            'status',
            'teacher_name',
            'participant_count',
            'target_languages',
            'created_at',
            'started_at',
            'ended_at',
        ]

    def get_participant_count(self, live_class):
        return live_class.participants.filter(left_at__isnull=True).count()

    def get_target_languages(self, live_class):
        return live_class.active_target_languages()


class LiveClassDetailSerializer(LiveClassSerializer):
    participants = ParticipantSerializer(many=True, read_only=True)

    class Meta(LiveClassSerializer.Meta):
        fields = LiveClassSerializer.Meta.fields + ['participants']


class JoinClassSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=6)
    target_language = LanguageCodeField()

    def validate_join_code(self, value):
        return value.strip().upper()


class LanguageChangeSerializer(serializers.Serializer):
    target_language = LanguageCodeField()


class RoomTokenSerializer(serializers.Serializer):
    token = serializers.CharField(read_only=True)
    url = serializers.CharField(read_only=True)
    room_name = serializers.CharField(read_only=True)
    identity = serializers.CharField(read_only=True)
    can_publish = serializers.BooleanField(read_only=True)


class UtteranceTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = UtteranceTranslation
        fields = [
            'target_language',
            'translated_text',
            'audio_base64',
            'audio_format',
            'translation_provider',
            'tts_provider',
        ]
        read_only_fields = fields


class ClassUtteranceSerializer(serializers.ModelSerializer):
    translations = UtteranceTranslationSerializer(many=True, read_only=True)

    class Meta:
        model = ClassUtterance
        fields = [
            'id',
            'sequence',
            'original_text',
            'source_language',
            'stt_provider',
            'latency_ms',
            'created_at',
            'translations',
        ]
        read_only_fields = fields


class ClassUtteranceRequestSerializer(serializers.Serializer):
    audio = serializers.FileField(write_only=True)
    speak = serializers.BooleanField(default=True, write_only=True)


class StreamItemSerializer(serializers.Serializer):
    sequence = serializers.IntegerField(read_only=True)
    original_text = serializers.CharField(read_only=True)
    translated_text = serializers.CharField(read_only=True)
    target_language = serializers.CharField(read_only=True)
    audio_base64 = serializers.CharField(read_only=True, allow_blank=True)
    audio_format = serializers.CharField(read_only=True, allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)


class StreamSerializer(serializers.Serializer):
    cursor = serializers.IntegerField(read_only=True)
    target_language = serializers.CharField(read_only=True)
    items = StreamItemSerializer(many=True, read_only=True)
