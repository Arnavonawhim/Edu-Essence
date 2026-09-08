from rest_framework.permissions import BasePermission

from EduEssence.backend.Auth.models import User


class IsTeacher(BasePermission):
    message = 'Only a teacher account can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.TEACHER)


class IsStudent(BasePermission):
    message = 'Only a student account can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.STUDENT)
