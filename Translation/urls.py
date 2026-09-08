from django.urls import path

from Translation.views import (
    LanguageListView,
    SessionDetailView,
    SessionEndView,
    SessionListCreateView,
    SpeechView,
    TextTranslationView,
    UtteranceView,
)

app_name = 'translation'

urlpatterns = [
    path('languages/', LanguageListView.as_view(), name='languages'),
    path('sessions/', SessionListCreateView.as_view(), name='session-list'),
    path('sessions/<int:session_id>/', SessionDetailView.as_view(), name='session-detail'),
    path('sessions/<int:session_id>/end/', SessionEndView.as_view(), name='session-end'),
    path('sessions/<int:session_id>/utterances/', UtteranceView.as_view(), name='session-utterance'),
    path('translate/', TextTranslationView.as_view(), name='translate-text'),
    path('speech/', SpeechView.as_view(), name='speech'),
]
