from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegistrationTests(APITestCase):
    url = reverse('auth:register')
    payload = {
        'username': 'student1',
        'first_name': 'Test',
        'last_name': 'Student',
        'email': 'student1@example.com',
        'password': 'Str0ngPass!23',
        'confirm_password': 'Str0ngPass!23',
    }

    def test_registration_creates_a_student_and_returns_tokens(self):
        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role'], User.Role.STUDENT)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])

    def test_registration_normalises_the_email(self):
        payload = {**self.payload, 'email': 'Student1@Example.com'}
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'student1@example.com')

    def test_registration_rejects_mismatched_passwords(self):
        payload = {**self.payload, 'confirm_password': 'Different!23'}
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    def test_registration_rejects_a_duplicate_email(self):
        self.client.post(self.url, self.payload, format='json')
        payload = {**self.payload, 'username': 'student2', 'email': 'STUDENT1@example.com'}
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)


class LoginTests(APITestCase):
    url = reverse('auth:login')

    def setUp(self):
        self.password = 'Str0ngPass!23'
        self.user = User.objects.create_user(
            email='student1@example.com',
            username='student1',
            first_name='Test',
            password=self.password,
        )

    def test_login_with_valid_credentials_returns_tokens(self):
        response = self.client.post(
            self.url,
            {'email': self.user.email, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['id'], self.user.id)

    def test_login_with_a_wrong_password_fails(self):
        response = self.client.post(
            self.url,
            {'email': self.user.email, 'password': 'wrong-password'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_is_rejected_for_an_inactive_account(self):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])

        response = self.client.post(
            self.url,
            {'email': self.user.email, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProfileTests(APITestCase):
    url = reverse('auth:profile')

    def setUp(self):
        self.user = User.objects.create_user(
            email='student1@example.com',
            username='student1',
            first_name='Test',
            password='Str0ngPass!23',
        )

    def test_profile_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_the_authenticated_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)


class LogoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='student1@example.com',
            username='student1',
            first_name='Test',
            password='Str0ngPass!23',
        )
        self.client.force_authenticate(user=self.user)

    def test_logout_blacklists_the_refresh_token(self):
        login = self.client.post(
            reverse('auth:login'),
            {'email': self.user.email, 'password': 'Str0ngPass!23'},
            format='json',
        )
        refresh = login.data['tokens']['refresh']

        response = self.client.post(reverse('auth:logout'), {'refresh': refresh}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        reuse = self.client.post(reverse('auth:token-refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED)
