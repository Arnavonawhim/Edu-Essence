from django.urls import path

from videos.views import (
    JobCancelView,
    JobDetailView,
    JobFileView,
    JobListCreateView,
    JobRetryView,
    LanguageListView,
)

app_name = 'dubbing'

urlpatterns = [
    path('languages/', LanguageListView.as_view(), name='languages'),
    path('jobs/', JobListCreateView.as_view(), name='job-list'),
    path('jobs/<int:job_id>/', JobDetailView.as_view(), name='job-detail'),
    path('jobs/<int:job_id>/cancel/', JobCancelView.as_view(), name='job-cancel'),
    path('jobs/<int:job_id>/retry/', JobRetryView.as_view(), name='job-retry'),
    path('jobs/<int:job_id>/files/<str:kind>/', JobFileView.as_view(), name='job-file'),
]
