from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from Auth.views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
)

app_name = 'auth'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('me/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
]
