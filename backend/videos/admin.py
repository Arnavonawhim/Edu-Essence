from django.contrib import admin

from videos.models import DubbingJob, Segment


@admin.register(DubbingJob)
class DubbingJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'title', 'status', 'stage', 'progress', 'diarize', 'clone_voices', 'created_at']
    list_filter = ['status', 'stage', 'diarize', 'clone_voices', 'source_language']
    search_fields = ['title', 'source_url', 'video_id', 'owner__email']
    readonly_fields = [
        'video_id',
        'title',
        'uploader',
        'duration_seconds',
        'detected_language',
        'language_probability',
        'asr_model',
        'word_aligned',
        'transcribed_until',
        'translation_model',
        'progress',
        'progress_message',
        'error_message',
        'stage_timings',
        'created_at',
        'started_at',
        'finished_at',
    ]


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'job', 'index', 'start', 'end', 'text', 'translated_text', 'confidence']
    list_filter = ['job']
    search_fields = ['text', 'translated_text']
    readonly_fields = ['words']
