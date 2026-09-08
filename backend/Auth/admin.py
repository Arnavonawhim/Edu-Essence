from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from EduEssence.backend.Auth.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['-date_joined']
    list_display = ['email', 'username', 'full_name', 'role', 'is_active', 'is_staff']
    list_filter = ['role', 'is_active', 'is_staff', 'is_email_verified']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    readonly_fields = ['date_joined', 'last_login']

    fieldsets = [
        (None, {'fields': ['email', 'username', 'password']}),
        ('Personal information', {'fields': ['first_name', 'last_name']}),
        ('Role and status', {'fields': ['role', 'is_email_verified', 'is_active', 'is_staff', 'is_superuser']}),
        ('Permissions', {'fields': ['groups', 'user_permissions']}),
        ('Important dates', {'fields': ['last_login', 'date_joined']}),
    ]

    add_fieldsets = [
        (None, {
            'classes': ['wide'],
            'fields': ['email', 'username', 'first_name', 'last_name', 'role', 'password1', 'password2'],
        }),
    ]
