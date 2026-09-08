import time

from django.db import transaction
from django.db.models import Max

from EduEssence.backend.Translation.models import TranscriptChunk
from EduEssence.backend.Translation.providers import speech_to_text, text_to_speech, translate_text


class EmptyTranscript(Exception):
    pass


def next_sequence(session):
    current = session.chunks.aggregate(value=Max('sequence'))['value']
    return (current or 0) + 1


def process_utterance(session, audio_bytes, filename, speak=True):
    started = time.perf_counter()

    original_text, stt_provider = speech_to_text(
        audio_bytes,
        filename,
        session.source_language,
    )
    if not original_text:
        raise EmptyTranscript

    translated_text, translation_provider = translate_text(
        original_text,
        session.source_language,
        session.target_language,
    )

    audio_base64 = None
    audio_format = None
    tts_provider = ''
    if speak:
        (audio_base64, audio_format), tts_provider = text_to_speech(
            translated_text,
            session.target_language,
        )

    latency_ms = int((time.perf_counter() - started) * 1000)

    with transaction.atomic():
        chunk = TranscriptChunk.objects.create(
            session=session,
            sequence=next_sequence(session),
            original_text=original_text,
            translated_text=translated_text,
            source_language=session.source_language,
            target_language=session.target_language,
            stt_provider=stt_provider,
            translation_provider=translation_provider,
            tts_provider=tts_provider,
            latency_ms=latency_ms,
        )

    return chunk, audio_base64, audio_format
