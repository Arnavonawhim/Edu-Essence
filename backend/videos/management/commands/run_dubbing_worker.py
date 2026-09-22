import logging
import sys
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from videos.pipeline.runner import claim_next_job, fail_interrupted_jobs, run_job


class Command(BaseCommand):
    help = 'Process queued dubbing jobs one at a time. Run it next to runserver.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='Process at most one job and exit instead of polling forever.',
        )
        parser.add_argument(
            '--poll-interval',
            type=float,
            default=settings.DUBBING_WORKER_POLL_SECONDS,
            help='Seconds to wait between checks when the queue is empty.',
        )

    def handle(self, *args, **options):
        self._configure_logging()

        interrupted = fail_interrupted_jobs()
        if interrupted:
            self.stdout.write(self.style.WARNING(
                f'Marked {interrupted} interrupted job(s) as failed. Retry them to resume.'
            ))

        self.stdout.write(self.style.SUCCESS('Dubbing worker ready. Waiting for jobs...'))

        try:
            while True:
                job = claim_next_job()
                if job:
                    run_job(job)
                    if options['once']:
                        return
                elif options['once']:
                    self.stdout.write('No queued jobs.')
                    return
                else:
                    time.sleep(options['poll_interval'])
        except KeyboardInterrupt:
            self.stdout.write('\nWorker stopped.')

    def _configure_logging(self):
        logger = logging.getLogger('videos.pipeline')
        if logger.handlers:
            return
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s  %(message)s', datefmt='%H:%M:%S'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
