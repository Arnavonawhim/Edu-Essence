import time
import uuid

import jwt
from django.conf import settings


class LiveKitNotConfigured(Exception):
    pass


def is_configured():
    return bool(settings.LIVEKIT_API_KEY and settings.LIVEKIT_API_SECRET and settings.LIVEKIT_URL)


def build_room_name(prefix='class'):
    return f'{prefix}-{uuid.uuid4().hex[:12]}'


def create_access_token(room_name, identity, display_name, can_publish):
    if not is_configured():
        raise LiveKitNotConfigured(
            'Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to use the online classroom.'
        )

    issued_at = int(time.time())
    claims = {
        'iss': settings.LIVEKIT_API_KEY,
        'sub': identity,
        'name': display_name,
        'nbf': issued_at,
        'iat': issued_at,
        'exp': issued_at + settings.LIVEKIT_TOKEN_TTL,
        'video': {
            'room': room_name,
            'roomJoin': True,
            'canPublish': can_publish,
            'canSubscribe': True,
            'canPublishData': True,
        },
    }

    return jwt.encode(claims, settings.LIVEKIT_API_SECRET, algorithm='HS256')
