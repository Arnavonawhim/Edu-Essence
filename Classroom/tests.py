from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Classroom.models import ClassParticipant, ClassUtterance, LiveClass

User = get_user_model()

LIVEKIT_SETTINGS = {
    'LIVEKIT_URL': 'wss://test.livekit.cloud',
    'LIVEKIT_API_KEY': 'devkey',
    'LIVEKIT_API_SECRET': 'devsecretdevsecretdevsecretdevsecret',
}


def make_user(email, username, role):
    return User.objects.create_user(
        email=email,
        username=username,
        first_name=username.title(),
        password='Str0ngPass!23',
        role=role,
    )


class ClassroomTestCase(APITestCase):
    def setUp(self):
        self.teacher = make_user('teacher@example.com', 'teacher', User.Role.TEACHER)
        self.student = make_user('student@example.com', 'student', User.Role.STUDENT)
        self.student2 = make_user('student2@example.com', 'student2', User.Role.STUDENT)

    def create_class(self, user=None):
        self.client.force_authenticate(user=user or self.teacher)
        return self.client.post(
            reverse('classroom:class-list'),
            {
                'title': 'Class 5 Science',
                'subject': 'Science',
                'topic': 'Photosynthesis',
                'source_language': 'en',
            },
            format='json',
        )

    def live_class_with_students(self, languages=('hi', 'mr')):
        response = self.create_class()
        class_id = response.data['id']
        join_code = response.data['join_code']
        self.client.post(reverse('classroom:class-start', args=[class_id]))

        for student, language in zip([self.student, self.student2], languages):
            self.client.force_authenticate(user=student)
            self.client.post(
                reverse('classroom:class-join'),
                {'join_code': join_code, 'target_language': language},
                format='json',
            )

        self.client.force_authenticate(user=self.teacher)
        return LiveClass.objects.get(id=class_id)


class RoleTests(ClassroomTestCase):
    def test_teacher_can_create_a_class(self):
        response = self.create_class()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['join_code']), 6)
        self.assertTrue(response.data['room_name'])

    def test_student_cannot_create_a_class(self):
        response = self.create_class(user=self.student)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_in_the_request_body_cannot_grant_teacher_access(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            reverse('classroom:class-list'),
            {
                'title': 'Sneaky',
                'source_language': 'en',
                'role': 'teacher',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, User.Role.STUDENT)

    def test_registration_can_choose_the_teacher_role(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse('auth:register'),
            {
                'username': 'newteacher',
                'first_name': 'New',
                'email': 'newteacher@example.com',
                'role': 'teacher',
                'password': 'Str0ngPass!23',
                'confirm_password': 'Str0ngPass!23',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role'], User.Role.TEACHER)

    def test_registration_defaults_to_student(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse('auth:register'),
            {
                'username': 'plain',
                'first_name': 'Plain',
                'email': 'plain@example.com',
                'password': 'Str0ngPass!23',
                'confirm_password': 'Str0ngPass!23',
            },
            format='json',
        )

        self.assertEqual(response.data['user']['role'], User.Role.STUDENT)

    def test_registration_rejects_a_privileged_role(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse('auth:register'),
            {
                'username': 'admin1',
                'first_name': 'Admin',
                'email': 'admin1@example.com',
                'role': 'superuser',
                'password': 'Str0ngPass!23',
                'confirm_password': 'Str0ngPass!23',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class JoinTests(ClassroomTestCase):
    def test_student_joins_with_the_code_and_picks_a_language(self):
        created = self.create_class()
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('classroom:class-join'),
            {'join_code': created.data['join_code'].lower(), 'target_language': 'hi'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['target_language'], 'hi')

    def test_a_wrong_code_is_rejected(self):
        self.create_class()
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('classroom:class-join'),
            {'join_code': 'ZZZZZZ', 'target_language': 'hi'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_student_can_change_listening_language(self):
        live_class = self.live_class_with_students()
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('classroom:class-language', args=[live_class.id]),
            {'target_language': 'bn'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['target_language'], 'bn')

    def test_leaving_removes_the_student_from_the_language_fan_out(self):
        live_class = self.live_class_with_students(languages=('hi', 'mr'))
        self.client.force_authenticate(user=self.student2)
        self.client.post(reverse('classroom:class-leave', args=[live_class.id]))

        self.assertEqual(live_class.active_target_languages(), ['hi'])

    def test_outsiders_cannot_read_a_class(self):
        live_class = self.live_class_with_students()
        outsider = make_user('outsider@example.com', 'outsider', User.Role.STUDENT)
        self.client.force_authenticate(user=outsider)

        response = self.client.get(reverse('classroom:class-detail', args=[live_class.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FanOutTests(ClassroomTestCase):
    def audio(self):
        return SimpleUploadedFile('utterance.webm', b'fake-audio-bytes', 'audio/webm')

    @patch('Classroom.pipeline.text_to_speech')
    @patch('Classroom.pipeline.translate_text')
    @patch('Classroom.pipeline.speech_to_text')
    def test_one_utterance_is_translated_once_per_unique_language(self, stt, translate, tts):
        live_class = self.live_class_with_students(languages=('hi', 'mr'))
        stt.return_value = ('Plants make food from sunlight.', 'groq')
        translate.side_effect = lambda text, source, target: (f'{target}-text', 'groq')
        tts.side_effect = lambda text, language: ((f'{language}-audio', 'audio/mpeg'), 'google')

        response = self.client.post(
            reverse('classroom:class-utterance', args=[live_class.id]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(stt.call_count, 1)
        self.assertEqual(translate.call_count, 2)
        languages = sorted(item['target_language'] for item in response.data['translations'])
        self.assertEqual(languages, ['hi', 'mr'])

    @patch('Classroom.pipeline.text_to_speech')
    @patch('Classroom.pipeline.translate_text')
    @patch('Classroom.pipeline.speech_to_text')
    def test_duplicate_languages_are_collapsed(self, stt, translate, tts):
        live_class = self.live_class_with_students(languages=('hi', 'hi'))
        stt.return_value = ('Plants make food.', 'groq')
        translate.return_value = ('पौधे भोजन बनाते हैं।', 'groq')
        tts.return_value = (('AUDIO', 'audio/mpeg'), 'google')

        self.client.post(
            reverse('classroom:class-utterance', args=[live_class.id]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.assertEqual(translate.call_count, 1)

    @patch('Classroom.pipeline.speech_to_text')
    def test_a_class_with_no_listeners_is_rejected(self, stt):
        created = self.create_class()
        self.client.post(reverse('classroom:class-start', args=[created.data['id']]))

        response = self.client.post(
            reverse('classroom:class-utterance', args=[created.data['id']]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        stt.assert_not_called()

    @patch('Classroom.pipeline.text_to_speech')
    @patch('Classroom.pipeline.translate_text')
    @patch('Classroom.pipeline.speech_to_text')
    def test_students_only_receive_their_own_language(self, stt, translate, tts):
        live_class = self.live_class_with_students(languages=('hi', 'mr'))
        stt.return_value = ('Plants make food.', 'groq')
        translate.side_effect = lambda text, source, target: (f'{target}-text', 'groq')
        tts.side_effect = lambda text, language: ((f'{language}-audio', 'audio/mpeg'), 'google')

        self.client.post(
            reverse('classroom:class-utterance', args=[live_class.id]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.get(
            reverse('classroom:class-stream', args=[live_class.id]), {'after': 0}
        )

        self.assertEqual(response.data['target_language'], 'hi')
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['translated_text'], 'hi-text')
        self.assertEqual(response.data['cursor'], 1)

    @patch('Classroom.pipeline.text_to_speech')
    @patch('Classroom.pipeline.translate_text')
    @patch('Classroom.pipeline.speech_to_text')
    def test_the_cursor_stops_repeat_delivery(self, stt, translate, tts):
        live_class = self.live_class_with_students(languages=('hi', 'hi'))
        stt.return_value = ('Plants make food.', 'groq')
        translate.return_value = ('पौधे भोजन बनाते हैं।', 'groq')
        tts.return_value = (('AUDIO', 'audio/mpeg'), 'google')

        self.client.post(
            reverse('classroom:class-utterance', args=[live_class.id]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.get(
            reverse('classroom:class-stream', args=[live_class.id]), {'after': 1}
        )

        self.assertEqual(response.data['items'], [])

    def test_audio_is_rejected_before_the_class_starts(self):
        created = self.create_class()

        response = self.client.post(
            reverse('classroom:class-utterance', args=[created.data['id']]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_students_cannot_push_audio(self):
        live_class = self.live_class_with_students()
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('classroom:class-utterance', args=[live_class.id]),
            {'audio': self.audio()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RoomTokenTests(ClassroomTestCase):
    @override_settings(**LIVEKIT_SETTINGS)
    def test_teacher_and_student_receive_tokens_for_the_same_room(self):
        live_class = self.live_class_with_students()

        teacher_response = self.client.get(reverse('classroom:class-token', args=[live_class.id]))
        self.client.force_authenticate(user=self.student)
        student_response = self.client.get(reverse('classroom:class-token', args=[live_class.id]))

        self.assertEqual(teacher_response.status_code, status.HTTP_200_OK)
        self.assertEqual(student_response.status_code, status.HTTP_200_OK)
        self.assertEqual(teacher_response.data['room_name'], student_response.data['room_name'])
        self.assertNotEqual(teacher_response.data['identity'], student_response.data['identity'])

    @override_settings(**LIVEKIT_SETTINGS)
    def test_the_token_carries_the_room_grant(self):
        import jwt

        live_class = self.live_class_with_students()
        response = self.client.get(reverse('classroom:class-token', args=[live_class.id]))

        claims = jwt.decode(
            response.data['token'],
            LIVEKIT_SETTINGS['LIVEKIT_API_SECRET'],
            algorithms=['HS256'],
        )
        self.assertEqual(claims['video']['room'], live_class.room_name)
        self.assertTrue(claims['video']['roomJoin'])
        self.assertEqual(claims['iss'], LIVEKIT_SETTINGS['LIVEKIT_API_KEY'])

    @override_settings(LIVEKIT_URL='', LIVEKIT_API_KEY='', LIVEKIT_API_SECRET='')
    def test_a_missing_livekit_config_returns_a_readable_error(self):
        live_class = self.live_class_with_students()
        response = self.client.get(reverse('classroom:class-token', args=[live_class.id]))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('LIVEKIT_URL', response.data['detail'])

    @override_settings(**LIVEKIT_SETTINGS)
    def test_outsiders_get_no_token(self):
        live_class = self.live_class_with_students()
        outsider = make_user('nope@example.com', 'nope', User.Role.STUDENT)
        self.client.force_authenticate(user=outsider)

        response = self.client.get(reverse('classroom:class-token', args=[live_class.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class LifecycleTests(ClassroomTestCase):
    def test_ending_a_class_marks_everyone_as_left(self):
        live_class = self.live_class_with_students()

        response = self.client.post(reverse('classroom:class-end', args=[live_class.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], LiveClass.Status.ENDED)
        self.assertFalse(
            ClassParticipant.objects.filter(live_class=live_class, left_at__isnull=True).exists()
        )

    def test_students_cannot_join_an_ended_class(self):
        created = self.create_class()
        self.client.post(reverse('classroom:class-end', args=[created.data['id']]))
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('classroom:class-join'),
            {'join_code': created.data['join_code'], 'target_language': 'hi'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transcript_is_readable_by_participants(self):
        live_class = self.live_class_with_students()
        ClassUtterance.objects.create(
            live_class=live_class,
            sequence=1,
            original_text='Plants make food.',
            source_language='en',
        )
        self.client.force_authenticate(user=self.student)

        response = self.client.get(reverse('classroom:class-transcript', args=[live_class.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
