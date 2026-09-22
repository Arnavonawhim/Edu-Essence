import logging
import time

from django.utils import timezone

from videos.models import DubbingJob
from videos.pipeline.audio import extract_speech_audio
from videos.pipeline.download import download_video
from videos.pipeline.exceptions import JobCancelled, PipelineError
from videos.pipeline.ffmpeg import require_binaries
from videos.pipeline.progress import ProgressReporter
from videos.pipeline.workspace import JobWorkspace

logger = logging.getLogger('videos.pipeline')

Stage = DubbingJob.Stage
PIPELINE = [
    (Stage.DOWNLOAD, download_video, 15),
    (Stage.EXTRACT_AUDIO, extract_speech_audio, 5),
]


def claim_next_job():
    candidates = (
        DubbingJob.objects
        .filter(status=DubbingJob.Status.QUEUED)
        .order_by('created_at')
        .values_list('pk', flat=True)[:5]
    )
    for job_id in candidates:
        claimed = DubbingJob.objects.filter(pk=job_id, status=DubbingJob.Status.QUEUED).update(
            status=DubbingJob.Status.RUNNING,
            started_at=timezone.now(),
            finished_at=None,
            error_message='',
            progress=0,
        )
        if claimed:
            return DubbingJob.objects.get(pk=job_id)
    return None


def fail_interrupted_jobs():
    return DubbingJob.objects.filter(status=DubbingJob.Status.RUNNING).update(
        status=DubbingJob.Status.FAILED,
        error_message='The worker stopped while this job was running. Retry it to resume.',
        finished_at=timezone.now(),
    )


def run_job(job):
    weights = {stage: weight for stage, _, weight in PIPELINE}
    reporter = ProgressReporter(job, weights)
    workspace = JobWorkspace(job)
    workspace.ensure()

    logger.info('[job %s] Started: %s', job.pk, job.source_url)

    try:
        require_binaries()
        for stage, run_stage, _ in PIPELINE:
            reporter.check_cancelled()
            reporter.start_stage(stage)

            started = time.monotonic()
            run_stage(job, workspace, reporter)
            _record_timing(job, stage, time.monotonic() - started)

    except JobCancelled:
        _finish(job)
        logger.info('[job %s] Cancelled', job.pk)
        return

    except PipelineError as error:
        _fail(job, error.message)
        logger.error('[job %s] Failed: %s', job.pk, error.message)
        return

    except Exception as error:
        _fail(job, f'Unexpected error: {error.__class__.__name__}: {error}')
        logger.exception('[job %s] Crashed', job.pk)
        return

    DubbingJob.objects.filter(pk=job.pk, status=DubbingJob.Status.RUNNING).update(
        status=DubbingJob.Status.COMPLETED,
        progress=100,
        progress_message='Done',
        finished_at=timezone.now(),
    )
    job.refresh_from_db()
    logger.info('[job %s] Completed in %.1f s', job.pk, job.processing_seconds or 0)


def _record_timing(job, stage, seconds):
    job.refresh_from_db(fields=['stage_timings'])
    timings = dict(job.stage_timings)
    timings[stage] = round(seconds, 1)
    DubbingJob.objects.filter(pk=job.pk).update(stage_timings=timings)
    job.stage_timings = timings


def _fail(job, message):
    DubbingJob.objects.filter(pk=job.pk, status=DubbingJob.Status.RUNNING).update(
        status=DubbingJob.Status.FAILED,
        error_message=message,
        finished_at=timezone.now(),
    )


def _finish(job):
    DubbingJob.objects.filter(pk=job.pk, finished_at__isnull=True).update(
        finished_at=timezone.now(),
    )
