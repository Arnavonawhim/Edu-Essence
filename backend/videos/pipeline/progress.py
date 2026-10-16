import logging
import time

from django.conf import settings

from videos.models import DubbingJob
from videos.pipeline.exceptions import JobCancelled

logger = logging.getLogger('videos.pipeline')


class ProgressReporter:
    def __init__(self, job, weights):
        self.job = job
        self.weights = weights
        self.total_weight = sum(weights.values())
        self.interval = settings.DUBBING_PROGRESS_INTERVAL_SECONDS
        self.stage = None
        self.stage_offset = 0
        self._last_flush = 0.0
        self._last_percent = -1

    def start_stage(self, stage):
        completed = 0
        for name, weight in self.weights.items():
            if name == stage:
                break
            completed += weight
        self.stage = stage
        self.stage_offset = completed
        self._write(stage=stage, percent=self._overall(0.0), message=DubbingJob.Stage(stage).label)
        logger.info('[job %s] %s', self.job.pk, DubbingJob.Stage(stage).label)

    def update(self, fraction, message=''):
        fraction = min(max(fraction, 0.0), 1.0)
        percent = self._overall(fraction)
        now = time.monotonic()

        if now - self._last_flush < self.interval and fraction < 1.0:
            return

        self._last_flush = now
        self.check_cancelled()
        self._write(percent=percent, message=message)

        if percent != self._last_percent:
            self._last_percent = percent
            logger.info('[job %s] %3d%% %s', self.job.pk, percent, message)

    def log(self, message):
        logger.info('[job %s] %s', self.job.pk, message)

    def check_cancelled(self):
        cancelled = DubbingJob.objects.filter(
            pk=self.job.pk,
            status=DubbingJob.Status.CANCELLED,
        ).exists()
        if cancelled:
            raise JobCancelled()

    def _overall(self, fraction):
        done = self.stage_offset + self.weights[self.stage] * fraction
        return int(done * 100 / self.total_weight)

    def _write(self, percent, message, stage=None):
        fields = {'progress': percent, 'progress_message': message[:255]}
        if stage:
            fields['stage'] = stage
        DubbingJob.objects.filter(pk=self.job.pk, status=DubbingJob.Status.RUNNING).update(**fields)
