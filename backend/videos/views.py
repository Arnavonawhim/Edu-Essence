from pathlib import Path

from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Auth.serializers import MessageSerializer
from videos.languages import SOURCE_LANGUAGES
from videos.models import DubbingJob, Segment
from videos.pipeline.workspace import JobWorkspace
from videos.serializers import (
    DOWNLOADABLE_FILES,
    DubbingJobCreateSerializer,
    DubbingJobSerializer,
    SegmentSerializer,
    SourceLanguageSerializer,
)
from videos.subtitles import build_srt


class SegmentPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class LanguageListView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SourceLanguageSerializer

    @extend_schema(
        tags=['Video Dubbing'],
        summary='List the source languages that can be dubbed into English',
        responses={200: SourceLanguageSerializer(many=True)},
    )
    def get(self, request):
        languages = [
            {'code': code, 'name': config['name'], 'translator': config['translator']}
            for code, config in SOURCE_LANGUAGES.items()
        ]
        return Response(languages, status=status.HTTP_200_OK)


class JobListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DubbingJobSerializer

    @extend_schema(
        tags=['Video Dubbing'],
        summary='List your dubbing jobs',
        responses={200: DubbingJobSerializer(many=True)},
    )
    def get(self, request):
        jobs = DubbingJob.objects.filter(owner=request.user)
        serializer = self.serializer_class(jobs, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Queue a YouTube video for dubbing',
        request=DubbingJobCreateSerializer,
        responses={201: DubbingJobSerializer},
    )
    def post(self, request):
        serializer = DubbingJobCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        job = serializer.save()

        payload = self.serializer_class(job, context={'request': request}).data
        return Response(payload, status=status.HTTP_201_CREATED)


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DubbingJobSerializer

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Get a job with its live progress',
        responses={200: DubbingJobSerializer},
    )
    def get(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)
        serializer = self.serializer_class(job, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Delete a job and all of its files',
        responses={204: None, 409: MessageSerializer},
    )
    def delete(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)

        if job.status == DubbingJob.Status.RUNNING:
            return Response(
                {'detail': 'Cancel the job before deleting it.'},
                status=status.HTTP_409_CONFLICT,
            )

        JobWorkspace(job).delete()
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobCancelView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DubbingJobSerializer

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Cancel a queued or running job',
        request=None,
        responses={200: DubbingJobSerializer, 400: MessageSerializer},
    )
    def post(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)
        cancelled = DubbingJob.objects.filter(pk=job.pk, status=DubbingJob.Status.QUEUED).update(
            status=DubbingJob.Status.CANCELLED,
            finished_at=timezone.now(),
        ) or DubbingJob.objects.filter(pk=job.pk, status=DubbingJob.Status.RUNNING).update(
            status=DubbingJob.Status.CANCELLED,
        )

        if not cancelled:
            return Response(
                {'detail': f'A {job.status} job cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job.refresh_from_db()
        serializer = self.serializer_class(job, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class JobRetryView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DubbingJobSerializer

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Queue a finished, failed or cancelled job again',
        description='Stages whose output is already on disk are skipped, so a retry resumes where the job stopped or runs stages added since it finished.',
        request=None,
        responses={200: DubbingJobSerializer, 400: MessageSerializer},
    )
    def post(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)

        requeued = DubbingJob.objects.filter(
            pk=job.pk,
            status__in=[
                DubbingJob.Status.COMPLETED,
                DubbingJob.Status.FAILED,
                DubbingJob.Status.CANCELLED,
            ],
        ).update(
            status=DubbingJob.Status.QUEUED,
            stage=DubbingJob.Stage.PENDING,
            progress=0,
            progress_message='',
            error_message='',
            started_at=None,
            finished_at=None,
        )

        if not requeued:
            return Response(
                {'detail': f'A {job.status} job cannot be retried.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job.refresh_from_db()
        serializer = self.serializer_class(job, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class JobFileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Download one of the files a job produced',
        responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
    )
    def get(self, request, job_id, kind):
        if kind not in DOWNLOADABLE_FILES:
            raise Http404('Unknown file.')

        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)
        path = JobWorkspace.existing(getattr(job, kind))
        if not path:
            raise Http404('This file has not been produced yet.')

        return FileResponse(
            open(path, 'rb'),
            as_attachment=True,
            filename=f'job_{job.pk}_{kind}{Path(path).suffix}',
        )


class JobSegmentListView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SegmentSerializer
    pagination_class = SegmentPagination

    @extend_schema(
        tags=['Video Dubbing'],
        summary='List the transcript segments of a job',
        responses={200: SegmentSerializer(many=True)},
    )
    def get(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)
        segments = Segment.objects.filter(job=job)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(segments, request, view=self)
        serializer = self.serializer_class(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class JobTranscriptView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Video Dubbing'],
        summary='Download the transcript as an SRT subtitle file',
        responses={(200, 'application/x-subrip'): OpenApiTypes.STR},
    )
    def get(self, request, job_id):
        job = get_object_or_404(DubbingJob, id=job_id, owner=request.user)
        segments = Segment.objects.filter(job=job)
        if not segments.exists():
            raise Http404('This job has no transcript yet.')

        response = HttpResponse(build_srt(segments), content_type='application/x-subrip; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="job_{job.pk}_transcript.srt"'
        return response
