from django.urls import path

from Classroom.views import (
    ClassDetailView,
    ClassEndView,
    ClassJoinView,
    ClassLanguageView,
    ClassLeaveView,
    ClassListCreateView,
    ClassStartView,
    ClassStreamView,
    ClassTranscriptView,
    ClassUtteranceView,
    RoomTokenView,
)

app_name = 'classroom'

urlpatterns = [
    path('classes/', ClassListCreateView.as_view(), name='class-list'),
    path('classes/join/', ClassJoinView.as_view(), name='class-join'),
    path('classes/<int:class_id>/', ClassDetailView.as_view(), name='class-detail'),
    path('classes/<int:class_id>/start/', ClassStartView.as_view(), name='class-start'),
    path('classes/<int:class_id>/end/', ClassEndView.as_view(), name='class-end'),
    path('classes/<int:class_id>/leave/', ClassLeaveView.as_view(), name='class-leave'),
    path('classes/<int:class_id>/language/', ClassLanguageView.as_view(), name='class-language'),
    path('classes/<int:class_id>/token/', RoomTokenView.as_view(), name='class-token'),
    path('classes/<int:class_id>/utterances/', ClassUtteranceView.as_view(), name='class-utterance'),
    path('classes/<int:class_id>/stream/', ClassStreamView.as_view(), name='class-stream'),
    path('classes/<int:class_id>/transcript/', ClassTranscriptView.as_view(), name='class-transcript'),
]
