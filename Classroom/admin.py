from django.contrib import admin

from Classroom.models import (
    ClassParticipant,
    ClassUtterance,
    LiveClass,
    UtteranceTranslation,
)


class ParticipantInline(admin.TabularInline):
    model = ClassParticipant
    extra = 0
    readonly_fields = ['student', 'target_language', 'joined_at', 'left_at']


@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'teacher', 'join_code', 'source_language', 'status', 'created_at']
    list_filter = ['status', 'source_language']
    search_fields = ['title', 'topic', 'join_code', 'teacher__email']
    readonly_fields = ['join_code', 'room_name']
    inlines = [ParticipantInline]


class TranslationInline(admin.TabularInline):
    model = UtteranceTranslation
    extra = 0
    readonly_fields = ['target_language', 'translated_text', 'translation_provider', 'tts_provider']
    exclude = ['audio_base64']


@admin.register(ClassUtterance)
class ClassUtteranceAdmin(admin.ModelAdmin):
    list_display = ['id', 'live_class', 'sequence', 'original_text', 'latency_ms', 'created_at']
    list_filter = ['source_language']
    search_fields = ['original_text']
    inlines = [TranslationInline]
