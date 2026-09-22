import shutil
from pathlib import Path

from django.conf import settings

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
from videos.pipeline.exceptions import PipelineError
from videos.pipeline.ffmpeg import probe_duration
from videos.pipeline.workspace import JobWorkspace


def _format_selector():
    height = settings.DUBBING_MAX_VIDEO_HEIGHT
    return (
        f'bv*[height<={height}][ext=mp4]+ba[ext=m4a]/'
        f'bv*[height<={height}]+ba/'
        f'b[height<={height}]/'
        'bv*+ba/b'
    )


class _DownloadProgress:
    def __init__(self, reporter, requested_formats):
        self.reporter = reporter
        sizes = [fmt.get('filesize') or fmt.get('filesize_approx') or 0 for fmt in requested_formats]
        total = sum(sizes)
        if len(sizes) > 1 and total:
            shares = [size / total for size in sizes]
        else:
            shares = [1.0 / max(len(sizes), 1)] * max(len(sizes), 1)

        self.offsets = {}
        start = 0.0
        for fmt, share in zip(requested_formats, shares):
            self.offsets[fmt.get('format_id')] = (start, share)
            start += share

    def __call__(self, status):
        if status['status'] != 'downloading':
            return

        format_id = status.get('info_dict', {}).get('format_id')
        start, share = self.offsets.get(format_id, (0.0, 1.0))
        total = status.get('total_bytes') or status.get('total_bytes_estimate')
        downloaded = status.get('downloaded_bytes') or 0
        file_fraction = downloaded / total if total else 0.0

        kind = 'audio' if status.get('info_dict', {}).get('vcodec') == 'none' else 'video'
        message = f'Downloading {kind}: {downloaded / 2**20:.1f} MiB'
        if total:
            message += f' of {total / 2**20:.1f} MiB'

        self.reporter.update(start + share * file_fraction, message)


def download_video(job, workspace, reporter):
    existing = JobWorkspace.existing(job.source_video)
    if existing:
        reporter.log(f'Reusing downloaded video {existing.name}')
        return

    options = {
        'format': _format_selector(),
        'merge_output_format': 'mp4',
        'outtmpl': workspace.download_template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'retries': 10,
        'fragment_retries': 10,
        'ffmpeg_location': shutil.which(settings.FFMPEG_BINARY),
    }

    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(job.source_url, download=False)
            _validate_metadata(info)
            _save_metadata(job, info)

            requested = info.get('requested_formats') or [info]
            ydl.add_progress_hook(_DownloadProgress(reporter, requested))

            # Reuses the metadata we already have instead of a second request.
            info = ydl.process_ie_result(info, download=True)
    except DownloadError as error:
        raise PipelineError(f'yt-dlp could not download the video: {_clean(error)}') from error

    video_path = _downloaded_path(info)
    duration = probe_duration(video_path)

    job.source_video.name = JobWorkspace.relative(video_path)
    job.duration_seconds = duration
    job.save(update_fields=['source_video', 'duration_seconds'])
    reporter.log(f'Downloaded {video_path.name} ({duration / 60:.1f} min)')


def _validate_metadata(info):
    if info.get('_type') == 'playlist':
        raise PipelineError('That URL is a playlist. Send the URL of a single video.')
    if info.get('is_live'):
        raise PipelineError('Live streams cannot be dubbed. Wait until the stream has ended.')

    duration = info.get('duration')
    limit = settings.DUBBING_MAX_DURATION_SECONDS
    if duration and duration > limit:
        raise PipelineError(
            f'The video is {duration / 3600:.1f} h long; the limit is {limit / 3600:.1f} h.'
        )


def _save_metadata(job, info):
    job.video_id = (info.get('id') or '')[:64]
    job.title = (info.get('title') or '')[:300]
    job.uploader = (info.get('uploader') or info.get('channel') or '')[:200]
    job.duration_seconds = info.get('duration')
    job.save(update_fields=['video_id', 'title', 'uploader', 'duration_seconds'])


def _downloaded_path(info):
    downloads = info.get('requested_downloads') or []
    filepath = downloads[0].get('filepath') if downloads else info.get('filepath')
    if not filepath or not Path(filepath).exists():
        raise PipelineError('yt-dlp finished but the video file is missing.')
    return Path(filepath)


def _clean(error):
    return str(error).replace('ERROR: ', '').strip()
