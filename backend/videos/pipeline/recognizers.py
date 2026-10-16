import time

import requests
import whisperx
from django.conf import settings
from whisperx.audio import N_SAMPLES, log_mel_spectrogram
from whisperx.utils import LANGUAGES, TO_LANGUAGE_CODE

from videos.pipeline import model_cache
from videos.pipeline.exceptions import PipelineError
from videos.pipeline.ffmpeg import encode_flac

ASR_OPTIONS = {
    'beam_size': 5,
    'condition_on_previous_text': False,
}

GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
GROQ_MAX_ATTEMPTS = 5
GROQ_MAX_WAIT_SECONDS = 120

NO_SPEECH_PROBABILITY = 0.6
LOW_AVERAGE_LOGPROB = -1.0


class WhisperXRecognizer:
    def __init__(self, device):
        self.device = device
        self.name = settings.DUBBING_WHISPER_MODEL
        self.compute_type = settings.DUBBING_WHISPER_COMPUTE_TYPE or ('float16' if device == 'cuda' else 'int8')

    @property
    def model(self):
        return model_cache.load(
            ('whisper', self.name, self.device, self.compute_type),
            lambda: whisperx.load_model(
                self.name,
                self.device,
                compute_type=self.compute_type,
                asr_options=ASR_OPTIONS,
            ),
        )

    def language_scores(self, window):
        model = self.model
        n_mels = model.model.feat_kwargs.get('feature_size') or 80
        features = log_mel_spectrogram(window, n_mels=n_mels, padding=N_SAMPLES - len(window))
        encoder_output = model.model.encode(features)
        ranked = model.model.model.detect_language(encoder_output)[0]
        return {token[2:-2]: probability for token, probability in ranked}

    def transcribe(self, chunk, language):
        return self.model.transcribe(
            chunk,
            batch_size=settings.DUBBING_WHISPER_BATCH_SIZE,
            language=language,
            task='transcribe',
        )['segments']


class GroqRecognizer:
    def __init__(self):
        if not settings.GROQ_API_KEY:
            raise PipelineError('DUBBING_ASR_PROVIDER is "groq" but GROQ_API_KEY is empty.')
        self.name = f'groq/{settings.DUBBING_GROQ_ASR_MODEL}'

    def language_scores(self, window):
        code = to_language_code(self._request(window).get('language', ''))
        return {code: 1.0} if code else {}

    def transcribe(self, chunk, language):
        segments = self._request(chunk, language).get('segments', [])
        return [
            {
                'text': segment['text'].strip(),
                'start': float(segment['start']),
                'end': float(segment['end']),
            }
            for segment in segments
            if not is_silence(segment)
        ]

    def _request(self, samples, language=None):
        data = {
            'model': settings.DUBBING_GROQ_ASR_MODEL,
            'response_format': 'verbose_json',
            'temperature': '0',
        }
        if language:
            data['language'] = language
        files = {'file': ('speech.flac', encode_flac(samples), 'audio/flac')}

        for attempt in range(1, GROQ_MAX_ATTEMPTS + 1):
            try:
                response = requests.post(
                    GROQ_TRANSCRIPTION_URL,
                    headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
                    data=data,
                    files=files,
                    timeout=settings.DUBBING_GROQ_TIMEOUT,
                )
            except requests.RequestException as error:
                if attempt == GROQ_MAX_ATTEMPTS:
                    raise PipelineError(f'Groq transcription failed: {error}') from error
                time.sleep(2 ** attempt)
                continue

            if response.status_code == 429 or response.status_code >= 500:
                wait = retry_after(response, attempt)
                if attempt == GROQ_MAX_ATTEMPTS or wait > GROQ_MAX_WAIT_SECONDS:
                    raise PipelineError(
                        f'Groq is rate limiting or unavailable ({response.status_code}). '
                        f'Retry the job in about {int(wait)} s; finished windows are kept.'
                    )
                time.sleep(wait)
                continue

            if response.status_code != 200:
                raise PipelineError(f'Groq rejected the audio ({response.status_code}): {response.text[:300]}')

            return response.json()


def get_recognizer(device):
    if settings.DUBBING_ASR_PROVIDER == 'groq':
        return GroqRecognizer()
    return WhisperXRecognizer(device)


def is_silence(segment):
    return (
        segment.get('no_speech_prob', 0.0) > NO_SPEECH_PROBABILITY
        and segment.get('avg_logprob', 0.0) < LOW_AVERAGE_LOGPROB
    )


def retry_after(response, attempt):
    try:
        return float(response.headers.get('retry-after', ''))
    except ValueError:
        return float(2 ** attempt)


def to_language_code(name):
    name = name.strip().lower()
    if name in LANGUAGES:
        return name
    return TO_LANGUAGE_CODE.get(name, '')
