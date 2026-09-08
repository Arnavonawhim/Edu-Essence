from django.contrib import admin

from EduEssence.backend.Translation.models import TeachingSession, TranscriptChunk


class TranscriptChunkInline(admin.TabularInline):
    model = TranscriptChunk
    extra = 0
    readonly_fields = ['sequence', 'original_text', 'translated_text', 'latency_ms', 'created_at']


@admin.register(TeachingSession)
class TeachingSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'topic', 'source_language', 'target_language', 'status', 'started_at']
    list_filter = ['status', 'mode', 'source_language', 'target_language']
    search_fields = ['topic', 'subject', 'owner__email']
    inlines = [TranscriptChunkInline]


@admin.register(TranscriptChunk)
class TranscriptChunkAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'sequence', 'original_text', 'translated_text', 'latency_ms']
    list_filter = ['source_language', 'target_language', 'stt_provider']
    search_fields = ['original_text', 'translated_text']
