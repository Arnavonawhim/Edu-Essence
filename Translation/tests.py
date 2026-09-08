from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Translation.models import TeachingSession, TranscriptChunk
from Translation.providers.base import ProviderError

User = get_user_model()


class TranslationTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='teacher@example.com',
            username='teacher',
            first_name='Teacher',
            password='Str0ngPass!23',
            role=User.Role.TEACHER,
        )
        self.client.force_authenticate(user=self.user)

    def create_session(self, **overrides):
        payload = {
            'topic': 'Photosynthesis',
            'subject': 'Science',
            'source_language': 'en',
            'target_language': 'hi',
            **overrides,
        }
        return self.client.post(reverse('translation:session-list'), payload, format='json')


class LanguageTests(TranslationTestCase):
    def test_languages_are_listed(self):
        response = self.client.get(reverse('translation:languages'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [language['code'] for language in response.data]
        self.assertIn('hi', codes)
        self.assertIn('en', codes)

    def test_languages_require_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse('translation:languages'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SessionTests(TranslationTestCase):
    def test_session_is_created_live(self):
        response = self.create_session()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], TeachingSession.Status.LIVE)

    def test_unsupported_language_is_rejected(self):
        response = self.create_session(target_language='zz')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('target_language', response.data)

    def test_identical_languages_are_rejected(self):
        response = self.create_session(target_language='en')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sessions_are_scoped_to_their_owner(self):
        session_id = self.create_session().data['id']
        other = User.objects.create_user(
            email='other@example.com',
            username='other',
            first_name='Other',
            password='Str0ngPass!23',
        )
        self.client.force_authenticate(user=other)

        response = self.client.get(
            reverse('translation:session-detail', args=[session_id])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_session_can_be_ended(self):
        session_id = self.create_session().data['id']
        response = self.client.post(reverse('translation:session-end', args=[session_id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], TeachingSession.Status.ENDED)
        self.assertIsNotNone(response.data['ended_at'])


class UtteranceTests(TranslationTestCase):
    def setUp(self):
        super().setUp()
        self.session_id = self.create_session().data['id']
        self.url = reverse('translation:session-utterance', args=[self.session_id])

    def audio(self):
        return SimpleUploadedFile('utterance.webm', b'fake-audio-bytes', 'audio/webm')

    @patch('Translation.pipeline.text_to_speech')
    @patch('Translation.pipeline.translate_text')
    @patch('Translation.pipeline.speech_to_text')
    def test_utterance_is_transcribed_translated_and_stored(self, stt, translate, tts):
        stt.return_value = ('Today we learn about photosynthesis.', 'groq')
        translate.return_value = ('आज हम प्रकाश संश्लेषण सीखेंगे।', 'groq')
        tts.return_value = (('BASE64AUDIO', 'audio/mpeg'), 'google')

        response = self.client.post(self.url, {'audio': self.audio()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['chunk']['sequence'], 1)
        self.assertEqual(response.data['chunk']['translated_text'], 'आज हम प्रकाश संश्लेषण सीखेंगे।')
        self.assertEqual(response.data['audio_base64'], 'BASE64AUDIO')
        self.assertEqual(TranscriptChunk.objects.count(), 1)

    @patch('Translation.pipeline.text_to_speech')
    @patch('Translation.pipeline.translate_text')
    @patch('Translation.pipeline.speech_to_text')
    def test_sequences_increment_within_a_session(self, stt, translate, tts):
        stt.return_value = ('One.', 'groq')
        translate.return_value = ('एक।', 'groq')
        tts.return_value = (('AUDIO', 'audio/mpeg'), 'google')

        self.client.post(self.url, {'audio': self.audio()}, format='multipart')
        response = self.client.post(self.url, {'audio': self.audio()}, format='multipart')

        self.assertEqual(response.data['chunk']['sequence'], 2)

    @patch('Translation.pipeline.speech_to_text')
    def test_silence_returns_no_content(self, stt):
        stt.return_value = ('', 'groq')

        response = self.client.post(self.url, {'audio': self.audio()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TranscriptChunk.objects.count(), 0)

    @patch('Translation.pipeline.speech_to_text')
    def test_provider_failure_returns_service_unavailable(self, stt):
        stt.side_effect = ProviderError('groq', 'connection reset')

        response = self.client.post(self.url, {'audio': self.audio()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('Translation.pipeline.text_to_speech')
    @patch('Translation.pipeline.translate_text')
    @patch('Translation.pipeline.speech_to_text')
    def test_speak_false_skips_synthesis(self, stt, translate, tts):
        stt.return_value = ('One.', 'groq')
        translate.return_value = ('एक।', 'groq')

        response = self.client.post(
            self.url,
            {'audio': self.audio(), 'speak': False},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['audio_base64'])
        tts.assert_not_called()

    def test_utterances_are_rejected_after_the_session_ends(self):
        self.client.post(reverse('translation:session-end', args=[self.session_id]))
        response = self.client.post(self.url, {'audio': self.audio()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProviderFallbackTests(TranslationTestCase):
    @override_settings(
        TRANSLATION_PROVIDER='groq',
        GROQ_API_KEY='test-key',
        SARVAM_API_KEY='test-key',
    )
    def test_translation_falls_back_to_the_next_provider(self):
        from Translation.providers import registry

        with patch.object(
            registry.GroqTranslator, 'translate', side_effect=ProviderError('groq', 'down')
        ), patch.object(registry.SarvamTranslator, 'translate', return_value='नमस्ते'):
            text, provider = registry.translate_text('Hello', 'en', 'hi')

        self.assertEqual(text, 'नमस्ते')
        self.assertEqual(provider, 'sarvam')

    def test_same_language_skips_the_provider(self):
        from Translation.providers import registry

        text, provider = registry.translate_text('Hello', 'en', 'en')

        self.assertEqual(text, 'Hello')
        self.assertEqual(provider, 'passthrough')
