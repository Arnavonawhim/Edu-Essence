import requests
from django.conf import settings

from Translation.languages import language_name, provider_code
from Translation.providers.base import Provider, ProviderError

GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate'

SYSTEM_PROMPT = (
    'You translate a primary school teacher for a young child. '
    'Translate the text from {source} into {target}. '
    'Use simple words a 10 year old understands and keep the teaching tone. '
    'Keep technical or scientific terms recognisable. '
    'Reply with the translation only, no notes and no quotes.'
)


class GroqTranslator(Provider):
    name = 'groq'

    def is_configured(self):
        return bool(settings.GROQ_API_KEY)

    def translate(self, text, source_language, target_language):
        payload = {
            'model': settings.GROQ_TRANSLATION_MODEL,
            'temperature': 0.2,
            'max_tokens': 512,
            'messages': [
                {
                    'role': 'system',
                    'content': SYSTEM_PROMPT.format(
                        source=language_name(source_language),
                        target=language_name(target_language),
                    ),
                },
                {'role': 'user', 'content': text},
            ],
        }

        try:
            response = requests.post(
                GROQ_CHAT_URL,
                headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
                json=payload,
                timeout=settings.PROVIDER_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise ProviderError(self.name, str(error))

        return response.json()['choices'][0]['message']['content'].strip()


class SarvamTranslator(Provider):
    name = 'sarvam'

    def is_configured(self):
        return bool(settings.SARVAM_API_KEY)

    def translate(self, text, source_language, target_language):
        payload = {
            'input': text,
            'source_language_code': provider_code(source_language, 'sarvam'),
            'target_language_code': provider_code(target_language, 'sarvam'),
            'speaker_gender': 'Female',
            'mode': 'formal',
            'model': settings.SARVAM_TRANSLATION_MODEL,
        }

        try:
            response = requests.post(
                SARVAM_TRANSLATE_URL,
                headers={'api-subscription-key': settings.SARVAM_API_KEY},
                json=payload,
                timeout=settings.PROVIDER_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise ProviderError(self.name, str(error))

        return response.json()['translated_text'].strip()
