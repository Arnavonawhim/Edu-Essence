import json

import numpy as np
import whisperx
from django.conf import settings
from django.db import transaction
from whisperx.audio import N_SAMPLES, SAMPLE_RATE

from videos.languages import SOURCE_LANGUAGES, is_supported
from videos.models import Segment
from videos.pipeline import model_cache
from videos.pipeline.audio import load_speech
from videos.pipeline.exceptions import PipelineError
from videos.pipeline.recognizers import get_recognizer
from videos.pipeline.segmentation import build_segments
from videos.pipeline.workspace import JobWorkspace

DETECTION_WINDOWS = 6
DETECTION_MIN_RMS = 0.01
BOUNDARY_SEARCH_SECONDS = 30
FRAME_SECONDS = 0.02
SMOOTHING_SECONDS = 0.5
DRAFT_SHARE = 0.8


def transcribe_speech(job, workspace, reporter):
    speech = JobWorkspace.existing(job.speech_audio)
    if not speech:
        raise PipelineError('The speech track is missing; retry the job to extract it again.')

    audio = load_speech(speech)
    total = len(audio) / SAMPLE_RATE
    windows = plan_windows(audio, settings.DUBBING_TRANSCRIBE_WINDOW_SECONDS)
    pending = [(start, end) for start, end in windows if end > job.transcribed_until + 0.001]

    if not pending:
        reporter.log('Transcript already complete')
        return

    device = model_cache.resolve_device()
    recognizer = get_recognizer(device)
    job.asr_model = recognizer.name
    job.save(update_fields=['asr_model'])

    language = resolve_language(job, recognizer, audio, reporter)
    drafts = draft_windows(workspace, recognizer, audio, pending, language, reporter)

    if not settings.DUBBING_KEEP_MODELS_LOADED:
        model_cache.release()

    aligner = load_aligner(job, language, device, reporter)

    Segment.objects.filter(job=job, start__gte=job.transcribed_until).delete()
    next_index = Segment.objects.filter(job=job).count()

    for (start, end), raw_segments in zip(pending, drafts):
        if raw_segments and aligner:
            align_model, align_metadata = aligner
            raw_segments = whisperx.align(
                raw_segments,
                align_model,
                align_metadata,
                audio_slice(audio, start, end),
                device,
                return_char_alignments=False,
            )['segments']

        segments = build_segments(raw_segments, language, offset=start)
        next_index = save_window(job, segments, end, next_index)
        reporter.update(
            DRAFT_SHARE + (1 - DRAFT_SHARE) * end / total,
            f'Aligned {clock(end)} of {clock(total)}',
        )

    reporter.log(f'{next_index} segments transcribed in {SOURCE_LANGUAGES[language]["name"]}')


def draft_windows(workspace, recognizer, audio, pending, language, reporter):
    total = len(audio) / SAMPLE_RATE
    drafts = []

    for number, (start, end) in enumerate(pending, start=1):
        path = workspace.draft_path(start)
        if path.exists():
            drafts.append(json.loads(path.read_text(encoding='utf-8')))
            continue

        reporter.log(f'Transcribing {clock(start)}-{clock(end)} (window {number} of {len(pending)}) with {recognizer.name}')
        raw_segments = recognizer.transcribe(audio_slice(audio, start, end), language)

        partial = path.with_suffix('.partial')
        partial.write_text(json.dumps(raw_segments, ensure_ascii=False, default=float), encoding='utf-8')
        partial.replace(path)

        drafts.append(raw_segments)
        reporter.update(DRAFT_SHARE * end / total, f'Transcribed {clock(end)} of {clock(total)}')

    return drafts


def load_aligner(job, language, device, reporter):
    try:
        aligner = model_cache.load(
            ('align', language, device),
            lambda: whisperx.load_align_model(language_code=language, device=device),
        )
    except ValueError:
        reporter.log(f'No alignment model for "{language}"; word timings will be estimated')
        aligner = None

    job.word_aligned = aligner is not None
    job.save(update_fields=['word_aligned'])
    return aligner


def resolve_language(job, recognizer, audio, reporter):
    if not job.detected_language:
        reporter.log(f'Detecting the spoken language with {recognizer.name}')
        detected, probability = detect_language(recognizer, audio)
        job.detected_language = detected
        job.language_probability = round(probability, 3)
        job.save(update_fields=['detected_language', 'language_probability'])
        reporter.log(f'Detected language "{detected}" ({probability:.0%})')

    detected = job.detected_language

    if job.source_language:
        if job.source_language != detected:
            reporter.log(f'Using the requested "{job.source_language}" instead of the detected "{detected}"')
        return job.source_language

    if detected == 'en':
        raise PipelineError('The video is already in English.')
    if not is_supported(detected):
        raise PipelineError(
            f'Detected language "{detected}" is not supported. '
            'Set source_language on the job if the detection is wrong.'
        )
    return detected


def detect_language(recognizer, audio):
    if len(audio) <= N_SAMPLES:
        starts = [0]
    else:
        starts = np.linspace(0, len(audio) - N_SAMPLES, DETECTION_WINDOWS).astype(int).tolist()

    windows = [audio[start:start + N_SAMPLES] for start in starts]
    voiced = [window for window in windows if rms(window) >= DETECTION_MIN_RMS] or windows

    totals = {}
    for window in voiced:
        for code, probability in recognizer.language_scores(window).items():
            totals[code] = totals.get(code, 0.0) + probability

    if not totals:
        raise PipelineError('Could not detect the spoken language. Set source_language on the job.')

    language = max(totals, key=totals.get)
    return language, totals[language] / len(voiced)


def plan_windows(audio, window_seconds):
    total = len(audio) / SAMPLE_RATE
    if total <= window_seconds * 1.5:
        return [(0.0, total)]

    boundaries = [0.0]
    target = window_seconds
    while total - target > window_seconds * 0.5:
        cut = quietest_point(audio, target - BOUNDARY_SEARCH_SECONDS, target + BOUNDARY_SEARCH_SECONDS)
        boundaries.append(cut)
        target = cut + window_seconds
    boundaries.append(total)

    return list(zip(boundaries[:-1], boundaries[1:]))


def quietest_point(audio, search_start, search_end):
    frame = int(FRAME_SECONDS * SAMPLE_RATE)
    region = audio[int(search_start * SAMPLE_RATE):int(search_end * SAMPLE_RATE)]
    frames = len(region) // frame

    energy = np.sqrt(np.mean(region[:frames * frame].reshape(frames, frame) ** 2, axis=1))
    kernel = max(1, int(SMOOTHING_SECONDS / FRAME_SECONDS))
    smoothed = np.convolve(energy, np.ones(kernel) / kernel, mode='same')

    return round(search_start + (int(np.argmin(smoothed)) + 0.5) * FRAME_SECONDS, 3)


def save_window(job, segments, window_end, next_index):
    rows = [
        Segment(
            job=job,
            index=next_index + position,
            start=segment['start'],
            end=segment['end'],
            text=segment['text'],
            words=segment['words'],
            confidence=segment['confidence'],
        )
        for position, segment in enumerate(segments)
    ]

    with transaction.atomic():
        Segment.objects.bulk_create(rows)
        job.transcribed_until = window_end
        job.save(update_fields=['transcribed_until'])

    return next_index + len(rows)


def audio_slice(audio, start, end):
    return audio[int(start * SAMPLE_RATE):int(end * SAMPLE_RATE)]


def rms(samples):
    return float(np.sqrt(np.mean(samples ** 2))) if len(samples) else 0.0


def clock(seconds):
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f'{hours}:{minutes:02}:{seconds:02}'
