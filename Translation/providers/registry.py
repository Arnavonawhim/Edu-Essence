import logging

from django.conf import settings

from Translation.providers.base import ProviderError
from Translation.providers.stt import GroqSTT, SarvamSTT
from Translation.providers.translate import GroqTranslator, SarvamTranslator
from Translation.providers.tts import GoogleTTS, SarvamTTS

logger = logging.getLogger(__name__)

STT_PROVIDERS = {'groq': GroqSTT, 'sarvam': SarvamSTT}
TRANSLATION_PROVIDERS = {'groq': GroqTranslator, 'sarvam': SarvamTranslator}
TTS_PROVIDERS = {'sarvam': SarvamTTS, 'google': GoogleTTS}


def _chain(available, preferred):
    ordered = [preferred] + [name for name in available if name != preferred]
    return [available[name]() for name in ordered if name in available]


def _configured(available, preferred):
    providers = [provider for provider in _chain(available, preferred) if provider.is_configured()]
    if not providers:
        raise ProviderError('registry', 'No provider is configured for this stage.')
    return providers


def _run(providers, call):
    failures = []

    for provider in providers:
        try:
            return call(provider), provider.name
        except ProviderError as error:
            logger.warning('Provider %s failed: %s', provider.name, error.message)
            failures.append(error.message)

    raise ProviderError('registry', ' | '.join(failures))


def speech_to_text(audio, filename, language):
    providers = _configured(STT_PROVIDERS, settings.STT_PROVIDER)
    return _run(providers, lambda provider: provider.transcribe(audio, filename, language))


def translate_text(text, source_language, target_language):
    if source_language == target_language:
        return text, 'passthrough'

    providers = _configured(TRANSLATION_PROVIDERS, settings.TRANSLATION_PROVIDER)
    return _run(
        providers,
        lambda provider: provider.translate(text, source_language, target_language),
    )


def text_to_speech(text, language):
    providers = _configured(TTS_PROVIDERS, settings.TTS_PROVIDER)
    return _run(providers, lambda provider: provider.synthesise(text, language))
