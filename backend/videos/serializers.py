from urllib.parse import urlparse

from django.urls import reverse
from rest_framework import serializers

from videos.languages import SOURCE_LANGUAGES
from videos.models import DubbingJob, Segment

YOUTUBE_HOSTS = {
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
}

MAX_SPEAKERS = 10

DOWNLOADABLE_FILES = ('source_video', 'speech_audio', 'output_video')


class SourceLanguageSerializer(serializers.Serializer):
    code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    translator = serializers.CharField(read_only=True)


class DubbingJobCreateSerializer(serializers.ModelSerializer):
    source_language = serializers.ChoiceField(
        choices=list(SOURCE_LANGUAGES),
        required=False,
        allow_blank=True,
        help_text='Leave empty to auto-detect. Setting it avoids detection mistakes on short intros.',
    )
    min_speakers = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=MAX_SPEAKERS)
    max_speakers = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=MAX_SPEAKERS)

    class Meta:
        model = DubbingJob
        fields = [
            'source_url',
            'source_language',
            'diarize',
            'clone_voices',
            'min_speakers',
            'max_speakers',
        ]

    def validate_source_url(self, value):
        host = (urlparse(value).hostname or '').lower()
        if host not in YOUTUBE_HOSTS:
            raise serializers.ValidationError('Only YouTube video URLs are supported.')
        return value

    def validate(self, attrs):
        min_speakers = attrs.get('min_speakers')
        max_speakers = attrs.get('max_speakers')

        if (min_speakers or max_speakers) and not attrs.get('diarize', True):
            raise serializers.ValidationError(
                {'diarize': 'Speaker counts only apply when diarization is on.'}
            )
        if min_speakers and max_speakers and min_speakers > max_speakers:
            raise serializers.ValidationError(
                {'max_speakers': 'max_speakers must be greater than or equal to min_speakers.'}
            )
        return attrs

    def create(self, validated_data):
        return DubbingJob.objects.create(
            owner=self.context['request'].user,
            **validated_data,
        )


class SegmentSerializer(serializers.ModelSerializer):
    duration = serializers.FloatField(read_only=True)

    class Meta:
        model = Segment
        fields = [
            'id',
            'index',
            'start',
            'end',
            'duration',
            'text',
            'translated_text',
            'confidence',
            'words',
        ]
        read_only_fields = fields


class DubbingJobSerializer(serializers.ModelSerializer):
    processing_seconds = serializers.FloatField(read_only=True, allow_null=True)
    segment_count = serializers.IntegerField(read_only=True, source='segments.count')
    translated_count = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()

    class Meta:
        model = DubbingJob
        fields = [
            'id',
            'source_url',
            'video_id',
            'title',
            'uploader',
            'duration_seconds',
            'source_language',
            'detected_language',
            'language_probability',
            'asr_model',
            'word_aligned',
            'transcribed_until',
            'segment_count',
            'translation_model',
            'translated_count',
            'diarize',
            'clone_voices',
            'min_speakers',
            'max_speakers',
            'status',
            'stage',
            'progress',
            'progress_message',
            'error_message',
            'stage_timings',
            'processing_seconds',
            'files',
            'created_at',
            'started_at',
            'finished_at',
        ]
        read_only_fields = fields

    def get_translated_count(self, job) -> int:
        return job.segments.exclude(translated_text='').count()

    def get_files(self, job) -> dict:
        request = self.context.get('request')
        links = {}
        for kind in DOWNLOADABLE_FILES:
            if getattr(job, kind):
                path = reverse('dubbing:job-file', kwargs={'job_id': job.pk, 'kind': kind})
                links[kind] = request.build_absolute_uri(path) if request else path
        return links
