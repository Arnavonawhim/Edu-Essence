import logging
import time
from concurrent.futures import ThreadPoolExecutor

from django.db import transaction
from django.db.models import Max

from EduEssence.backend.Classroom.models import ClassUtterance, UtteranceTranslation
from EduEssence.backend.Translation.providers import (
    ProviderError,
    speech_to_text,
    text_to_speech,
    translate_text,
)

logger = logging.getLogger(__name__)


class EmptyTranscript(Exception):
    pass


class NoListeners(Exception):
    pass


def next_sequence(live_class):
    current = live_class.utterances.aggregate(value=Max('sequence'))['value']
    return (current or 0) + 1


def render_language(text, source_language, target_language, speak):
    translated_text, translation_provider = translate_text(text, source_language, target_language)

    audio_base64 = ''
    audio_format = ''
    tts_provider = ''
    if speak:
        (audio_base64, audio_format), tts_provider = text_to_speech(translated_text, target_language)

    return {
        'target_language': target_language,
        'translated_text': translated_text,
        'audio_base64': audio_base64,
        'audio_format': audio_format,
        'translation_provider': translation_provider,
        'tts_provider': tts_provider,
    }


def fan_out(text, source_language, target_languages, speak):
    with ThreadPoolExecutor(max_workers=len(target_languages)) as executor:
        futures = {
            executor.submit(render_language, text, source_language, language, speak): language
            for language in target_languages
        }
        results = []
        failures = []

        for future, language in futures.items():
            try:
                results.append(future.result())
            except ProviderError as error:
                logger.warning('Language %s failed: %s', language, error.message)
                failures.append(f'{language}: {error.message}')

    if not results:
        raise ProviderError('fan-out', ' | '.join(failures))

    return results


def process_class_utterance(live_class, audio_bytes, filename, speak=True):
    target_languages = live_class.active_target_languages()
    if not target_languages:
        raise NoListeners

    started = time.perf_counter()

    original_text, stt_provider = speech_to_text(audio_bytes, filename, live_class.source_language)
    if not original_text:
        raise EmptyTranscript

    rendered = fan_out(original_text, live_class.source_language, target_languages, speak)
    latency_ms = int((time.perf_counter() - started) * 1000)

    with transaction.atomic():
        utterance = ClassUtterance.objects.create(
            live_class=live_class,
            sequence=next_sequence(live_class),
            original_text=original_text,
            source_language=live_class.source_language,
            stt_provider=stt_provider,
            latency_ms=latency_ms,
        )
        UtteranceTranslation.objects.bulk_create(
            [UtteranceTranslation(utterance=utterance, **item) for item in rendered]
        )

    return utterance
