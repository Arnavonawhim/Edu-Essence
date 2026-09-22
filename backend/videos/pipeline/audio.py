from videos.pipeline.exceptions import PipelineError
from videos.pipeline.ffmpeg import run_ffmpeg
from videos.pipeline.workspace import JobWorkspace

SPEECH_SAMPLE_RATE = 16000


def extract_speech_audio(job, workspace, reporter):
    existing = JobWorkspace.existing(job.speech_audio)
    if existing:
        reporter.log(f'Reusing extracted audio {existing.name}')
        return

    source = JobWorkspace.existing(job.source_video)
    if not source:
        raise PipelineError('The downloaded video is missing; retry the job to download it again.')

    target = workspace.speech_audio
    partial = target.with_suffix('.partial.wav')

    run_ffmpeg(
        [
            '-i', str(source),
            '-map', '0:a:0',           
            '-vn',                    
            '-ac', '1',                 
            '-ar', str(SPEECH_SAMPLE_RATE),
            '-c:a', 'pcm_s16le',        
            str(partial),
        ],
        duration=job.duration_seconds,
        on_progress=lambda fraction: reporter.update(fraction, 'Extracting speech track'),
    )

    partial.replace(target)

    job.speech_audio.name = JobWorkspace.relative(target)
    job.save(update_fields=['speech_audio'])
    reporter.log(f'Speech track ready ({target.stat().st_size / 2**20:.1f} MiB)')
