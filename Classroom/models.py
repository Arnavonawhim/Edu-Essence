import secrets
import string

from django.conf import settings
from django.db import models

from Translation.languages import LANGUAGE_CHOICES

JOIN_CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_join_code():
    return ''.join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(6))


class LiveClass(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        LIVE = 'live', 'Live'
        ENDED = 'ended', 'Ended'

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='classes_taught',
    )
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=100, blank=True)
    topic = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    join_code = models.CharField(max_length=6, unique=True, default=generate_join_code)
    room_name = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'live_classes'
        ordering = ['-created_at']
        verbose_name_plural = 'Live classes'

    def __str__(self):
        return f'{self.title} ({self.join_code})'

    @property
    def is_live(self):
        return self.status == self.Status.LIVE

    @property
    def is_ended(self):
        return self.status == self.Status.ENDED

    def active_target_languages(self):
        codes = (
            self.participants.filter(left_at__isnull=True)
            .exclude(target_language=self.source_language)
            .values_list('target_language', flat=True)
            .distinct()
        )
        return sorted(set(codes))


class ClassParticipant(models.Model):
    live_class = models.ForeignKey(
        LiveClass,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='class_participations',
    )
    target_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'class_participants'
        ordering = ['joined_at']
        constraints = [
            models.UniqueConstraint(
                fields=['live_class', 'student'],
                name='unique_participant_per_class',
            )
        ]

    def __str__(self):
        return f'{self.student} in {self.live_class_id} ({self.target_language})'

    @property
    def is_active(self):
        return self.left_at is None


class ClassUtterance(models.Model):
    live_class = models.ForeignKey(
        LiveClass,
        on_delete=models.CASCADE,
        related_name='utterances',
    )
    sequence = models.PositiveIntegerField()
    original_text = models.TextField()
    source_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    stt_provider = models.CharField(max_length=30, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'class_utterances'
        ordering = ['sequence']
        constraints = [
            models.UniqueConstraint(
                fields=['live_class', 'sequence'],
                name='unique_utterance_sequence_per_class',
            )
        ]

    def __str__(self):
        return f'{self.live_class_id} #{self.sequence}'


class UtteranceTranslation(models.Model):
    utterance = models.ForeignKey(
        ClassUtterance,
        on_delete=models.CASCADE,
        related_name='translations',
    )
    target_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    translated_text = models.TextField()
    audio_base64 = models.TextField(blank=True)
    audio_format = models.CharField(max_length=30, blank=True)
    translation_provider = models.CharField(max_length=30, blank=True)
    tts_provider = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'utterance_translations'
        ordering = ['target_language']
        constraints = [
            models.UniqueConstraint(
                fields=['utterance', 'target_language'],
                name='unique_translation_per_language',
            )
        ]

    def __str__(self):
        return f'{self.utterance_id} to {self.target_language}'


CLASS_STATUS_CHOICES = LiveClass.Status.choices
