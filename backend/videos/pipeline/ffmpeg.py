import json
import shutil
import subprocess
from collections import deque

from django.conf import settings

from videos.pipeline.exceptions import PipelineError


def require_binaries():
    missing = [
        binary
        for binary in (settings.FFMPEG_BINARY, settings.FFPROBE_BINARY)
        if shutil.which(binary) is None
    ]
    if missing:
        raise PipelineError(
            f'Could not find {", ".join(missing)} on this machine. Install ffmpeg '
            'and put it on PATH, or set FFMPEG_BINARY / FFPROBE_BINARY in .env.'
        )


def probe_duration(path):
    command = [
        settings.FFPROBE_BINARY,
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        str(path),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise PipelineError(f'ffprobe could not read {path.name}: {result.stderr.strip()}')

    try:
        return float(json.loads(result.stdout)['format']['duration'])
    except (KeyError, ValueError) as error:
        raise PipelineError(f'ffprobe returned no duration for {path.name}.') from error


def run_ffmpeg(arguments, duration=None, on_progress=None):
    command = [
        settings.FFMPEG_BINARY,
        '-hide_banner',
        '-nostdin',
        '-loglevel', 'error',
        '-y',
        '-progress', 'pipe:1',
        '-nostats',
        *arguments,
    ]
    error_tail = deque(maxlen=20)
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )

    try:
        for line in process.stdout:
            key, _, value = line.strip().partition('=')
            if key == 'out_time_us' and duration and on_progress:
                try:
                    seconds = int(value) / 1_000_000
                except ValueError:
                    continue
                on_progress(seconds / duration)
            elif key not in PROGRESS_KEYS:
                error_tail.append(line.strip())
        process.wait()
    except BaseException:
        process.kill()
        process.wait()
        raise

    if process.returncode != 0:
        detail = ' | '.join(line for line in error_tail if line) or 'no output'
        raise PipelineError(f'ffmpeg exited with code {process.returncode}: {detail}')


PROGRESS_KEYS = {
    'frame', 'fps', 'stream_0_0_q', 'bitrate', 'total_size', 'out_time_us',
    'out_time_ms', 'out_time', 'dup_frames', 'drop_frames', 'speed', 'progress',
}
