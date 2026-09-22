from django.conf import settings
from django.db import models

from videos.languages import SOURCE_LANGUAGE_CHOICES


class DubbingJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    class Stage(models.TextChoices):
        PENDING = 'pending', 'Pending'
        DOWNLOAD = 'download', 'Downloading video'
        EXTRACT_AUDIO = 'extract_audio', 'Extracting audio'
        TRANSCRIBE = 'transcribe', 'Transcribing speech'
        DIARIZE = 'diarize', 'Identifying speakers'
        TRANSLATE = 'translate', 'Translating'
        SYNTHESIZE = 'synthesize', 'Synthesising English speech'
        MIX = 'mix', 'Mixing and muxing'

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dubbing_jobs',
    )
    source_url = models.URLField(max_length=500)

    video_id = models.CharField(max_length=64, blank=True)
    title = models.CharField(max_length=300, blank=True)
    uploader = models.CharField(max_length=200, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)

    source_language = models.CharField(max_length=10, choices=SOURCE_LANGUAGE_CHOICES, blank=True)
    detected_language = models.CharField(max_length=10, blank=True)
    diarize = models.BooleanField(default=True)
    clone_voices = models.BooleanField(default=True)
    min_speakers = models.PositiveSmallIntegerField(null=True, blank=True)
    max_speakers = models.PositiveSmallIntegerField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.PENDING)
    progress = models.PositiveSmallIntegerField(default=0)
    progress_message = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    # Paths are relative to MEDIA_ROOT and written by the pipeline, never uploaded.
    source_video = models.FileField(max_length=500, blank=True)
    speech_audio = models.FileField(max_length=500, blank=True)
    output_video = models.FileField(max_length=500, blank=True)

    stage_timings = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dubbing_jobs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='dubbing_job_queue_idx'),
        ]

    def __str__(self):
        return f'Job {self.pk}: {self.title or self.source_url}'

    @property
    def is_active(self):
        return self.status in (self.Status.QUEUED, self.Status.RUNNING)

    @property
    def can_retry(self):
        return self.status in (self.Status.FAILED, self.Status.CANCELLED)

    @property
    def processing_seconds(self):
        if not (self.started_at and self.finished_at):
            return None
        return round((self.finished_at - self.started_at).total_seconds(), 1)


JOB_STATUS_CHOICES = DubbingJob.Status.choices
JOB_STAGE_CHOICES = DubbingJob.Stage.choices
