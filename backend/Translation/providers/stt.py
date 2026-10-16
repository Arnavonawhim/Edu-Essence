import requests
from django.conf import settings

from Translation.languages import provider_code
from Translation.providers.base import Provider, ProviderError

GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
SARVAM_TRANSCRIPTION_URL = 'https://api.sarvam.ai/speech-to-text'


class GroqSTT(Provider):
    name = 'groq'

    def is_configured(self):
        return bool(settings.GROQ_API_KEY)

    def transcribe(self, audio, filename, language):
        files = {'file': (filename, audio, 'application/octet-stream')}
        data = {
            'model': settings.GROQ_STT_MODEL,
            'language': provider_code(language, 'whisper'),
            'response_format': 'json',
            'temperature': '0',
        }

        try:
            response = requests.post(
                GROQ_TRANSCRIPTION_URL,
                headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
                files=files,
                data=data,
                timeout=settings.PROVIDER_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise ProviderError(self.name, str(error))

        return response.json().get('text', '').strip()


class SarvamSTT(Provider):
    name = 'sarvam'

    def is_configured(self):
        return bool(settings.SARVAM_API_KEY)

    def transcribe(self, audio, filename, language):
        files = {'file': (filename, audio, 'application/octet-stream')}
        data = {
            'model': settings.SARVAM_STT_MODEL,
            'language_code': provider_code(language, 'sarvam'),
        }

        try:
            response = requests.post(
                SARVAM_TRANSCRIPTION_URL,
                headers={'api-subscription-key': settings.SARVAM_API_KEY},
                files=files,
                data=data,
                timeout=settings.PROVIDER_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise ProviderError(self.name, str(error))

        return response.json().get('transcript', '').strip()
