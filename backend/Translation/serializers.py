from rest_framework import serializers

from Translation.languages import LANGUAGES, is_supported
from Translation.models import TeachingSession, TranscriptChunk


class LanguageSerializer(serializers.Serializer):
    code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    native_name = serializers.CharField(read_only=True)


class LanguageCodeField(serializers.CharField):
    def to_internal_value(self, data):
        code = super().to_internal_value(data).strip().lower()
        if not is_supported(code):
            raise serializers.ValidationError(
                f'Unsupported language. Choose one of: {", ".join(LANGUAGES)}.'
            )
        return code


class TranscriptChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranscriptChunk
        fields = [
            'id',
            'sequence',
            'original_text',
            'translated_text',
            'source_language',
            'target_language',
            'stt_provider',
            'translation_provider',
            'tts_provider',
            'latency_ms',
            'created_at',
        ]
        read_only_fields = fields


class TeachingSessionSerializer(serializers.ModelSerializer):
    source_language = LanguageCodeField()
    target_language = LanguageCodeField()
    chunk_count = serializers.IntegerField(read_only=True, source='chunks.count')

    class Meta:
        model = TeachingSession
        fields = [
            'id',
            'title',
            'subject',
            'topic',
            'source_language',
            'target_language',
            'mode',
            'status',
            'chunk_count',
            'started_at',
            'ended_at',
        ]
        read_only_fields = ['id', 'status', 'chunk_count', 'started_at', 'ended_at']

    def validate(self, attrs):
        if attrs['source_language'] == attrs['target_language']:
            raise serializers.ValidationError(
                {'target_language': 'The target language must differ from the source language.'}
            )
        return attrs

    def create(self, validated_data):
        return TeachingSession.objects.create(
            owner=self.context['request'].user,
            **validated_data,
        )


class TeachingSessionDetailSerializer(TeachingSessionSerializer):
    chunks = TranscriptChunkSerializer(many=True, read_only=True)

    class Meta(TeachingSessionSerializer.Meta):
        fields = TeachingSessionSerializer.Meta.fields + ['chunks']


class UtteranceRequestSerializer(serializers.Serializer):
    audio = serializers.FileField(write_only=True)
    speak = serializers.BooleanField(default=True, write_only=True)


class UtteranceResponseSerializer(serializers.Serializer):
    chunk = TranscriptChunkSerializer(read_only=True)
    audio_base64 = serializers.CharField(read_only=True, allow_null=True)
    audio_format = serializers.CharField(read_only=True, allow_null=True)


class SpeechRequestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)
    language = LanguageCodeField()


class SpeechResponseSerializer(serializers.Serializer):
    audio_base64 = serializers.CharField(read_only=True)
    audio_format = serializers.CharField(read_only=True)
    provider = serializers.CharField(read_only=True)


class TextTranslationRequestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=4000)
    source_language = LanguageCodeField()
    target_language = LanguageCodeField()


class TextTranslationResponseSerializer(serializers.Serializer):
    original_text = serializers.CharField(read_only=True)
    translated_text = serializers.CharField(read_only=True)
    provider = serializers.CharField(read_only=True)
