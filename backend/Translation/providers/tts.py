import base64
import io

import requests
from django.conf import settings
from gtts import gTTS, gTTSError

from EduEssence.backend.Translation.languages import provider_code
from EduEssence.backend.Translation.providers.base import Provider, ProviderError

SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech'


class SarvamTTS(Provider):
    name = 'sarvam'

    def is_configured(self):
        return bool(settings.SARVAM_API_KEY)

    def synthesise(self, text, language):
        payload = {
            'inputs': [text[:500]],
            'target_language_code': provider_code(language, 'sarvam'),
            'speaker': settings.SARVAM_TTS_SPEAKER,
            'model': settings.SARVAM_TTS_MODEL,
            'speech_sample_rate': 22050,
            'enable_preprocessing': True,
        }

        try:
            response = requests.post(
                SARVAM_TTS_URL,
                headers={'api-subscription-key': settings.SARVAM_API_KEY},
                json=payload,
                timeout=settings.PROVIDER_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise ProviderError(self.name, str(error))

        return response.json()['audios'][0], 'audio/wav'


class GoogleTTS(Provider):
    name = 'google'

    def is_configured(self):
        return True

    def synthesise(self, text, language):
        buffer = io.BytesIO()

        try:
            gTTS(text=text, lang=provider_code(language, 'gtts'), slow=False).write_to_fp(buffer)
        except (gTTSError, ValueError, AssertionError) as error:
            raise ProviderError(self.name, str(error))

        return base64.b64encode(buffer.getvalue()).decode(), 'audio/mpeg'
