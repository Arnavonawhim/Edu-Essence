from django.conf import settings

from videos.languages import SOURCE_LANGUAGES
from videos.models import Segment
from videos.pipeline import model_cache
from videos.pipeline.exceptions import PipelineError
from videos.pipeline.translators import get_translator

OVERFLOW_WEIGHT = 2.0
MIN_LENGTH_RATIO = 0.6


def translate_segments(job, workspace, reporter):
    language = job.transcript_language
    if not language:
        raise PipelineError('The job has no transcript language yet; transcription must run first.')

    pending = list(Segment.objects.filter(job=job, translated_text=''))
    if not pending:
        reporter.log('Translation already complete')
        return

    translator = get_translator(language, model_cache.resolve_device())
    job.translation_model = translator.name
    job.save(update_fields=['translation_model'])
    reporter.log(
        f'Translating {len(pending)} segments from {SOURCE_LANGUAGES[language]["name"]} with {translator.name}'
    )

    ordered = sorted(pending, key=lambda segment: len(segment.text), reverse=True)
    batch_size = settings.DUBBING_TRANSLATION_BATCH_SIZE
    done = 0

    for offset in range(0, len(ordered), batch_size):
        batch = ordered[offset:offset + batch_size]
        options = translator.translate([segment.text for segment in batch], language)

        for segment, candidates in zip(batch, options):
            segment.translated_text = choose_candidate(candidates, segment.end - segment.start)
        Segment.objects.bulk_update(batch, ['translated_text'])

        done += len(batch)
        reporter.update(done / len(ordered), f'Translated {done} of {len(ordered)} segments')


def choose_candidate(candidates, slot_seconds):
    candidates = [(text, score) for text, score in candidates if text]
    if not candidates:
        return ''

    best_text, best_score = max(candidates, key=lambda candidate: candidate[1])
    eligible = [
        text
        for text, score in candidates
        if score >= best_score - settings.DUBBING_TRANSLATION_SCORE_TOLERANCE
        and len(text) >= len(best_text) * MIN_LENGTH_RATIO
    ]
    return min(eligible, key=lambda text: timing_cost(text, slot_seconds))


def timing_cost(text, slot_seconds):
    spoken_seconds = len(text) / settings.DUBBING_ENGLISH_CHARS_PER_SECOND
    overflow = max(spoken_seconds - slot_seconds, 0.0)
    underflow = max(slot_seconds - spoken_seconds, 0.0)
    return overflow * OVERFLOW_WEIGHT + underflow
