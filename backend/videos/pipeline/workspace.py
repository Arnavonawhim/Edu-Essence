import shutil
from pathlib import Path

from django.conf import settings


class JobWorkspace:
    def __init__(self, job):
        self.root = Path(settings.MEDIA_ROOT) / 'dubbing' / f'job_{job.pk}'
        self.audio_dir = self.root / 'audio'
        self.work_dir = self.root / 'work'
        self.output_dir = self.root / 'output'
        self.drafts_dir = self.work_dir / 'transcript_drafts'

    @property
    def download_template(self):
        return str(self.root / 'source.%(ext)s')

    @property
    def speech_audio(self):
        return self.audio_dir / 'speech_16k.wav'

    def draft_path(self, window_start):
        return self.drafts_dir / f'window_{round(window_start * 1000):09d}.json'

    def ensure(self):
        for folder in (self.root, self.audio_dir, self.work_dir, self.output_dir, self.drafts_dir):
            folder.mkdir(parents=True, exist_ok=True)

    def delete(self):
        shutil.rmtree(self.root, ignore_errors=True)

    @staticmethod
    def relative(path):
        return Path(path).resolve().relative_to(Path(settings.MEDIA_ROOT).resolve()).as_posix()

    @staticmethod
    def existing(field_file):
        if not field_file:
            return None
        path = Path(field_file.path)
        return path if path.exists() else None
