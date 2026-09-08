from django.conf import settings
from django.db import models

from Translation.languages import LANGUAGE_CHOICES


class TeachingSession(models.Model):
    class Status(models.TextChoices):
        LIVE = 'live', 'Live'
        ENDED = 'ended', 'Ended'

    class Mode(models.TextChoices):
        IN_PERSON = 'in_person', 'In person'
        ONLINE = 'online', 'Online'

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teaching_sessions',
    )
    title = models.CharField(max_length=200, blank=True)
    subject = models.CharField(max_length=100, blank=True)
    topic = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    target_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.IN_PERSON)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LIVE)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'teaching_sessions'
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.topic or self.subject or "Session"} ({self.source_language} to {self.target_language})'

    @property
    def is_live(self):
        return self.status == self.Status.LIVE


class TranscriptChunk(models.Model):
    session = models.ForeignKey(
        TeachingSession,
        on_delete=models.CASCADE,
        related_name='chunks',
    )
    sequence = models.PositiveIntegerField()
    original_text = models.TextField()
    translated_text = models.TextField()
    source_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    target_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    stt_provider = models.CharField(max_length=30, blank=True)
    translation_provider = models.CharField(max_length=30, blank=True)
    tts_provider = models.CharField(max_length=30, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transcript_chunks'
        ordering = ['sequence']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'sequence'],
                name='unique_chunk_sequence_per_session',
            )
        ]

    def __str__(self):
        return f'{self.session_id} #{self.sequence}'
