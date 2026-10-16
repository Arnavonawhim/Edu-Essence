import gc
import logging

import torch
from django.conf import settings

logger = logging.getLogger('videos.pipeline')

_loaded = {}


def resolve_device():
    if settings.DUBBING_DEVICE != 'auto':
        return settings.DUBBING_DEVICE
    return 'cuda' if torch.cuda.is_available() else 'cpu'


def load(key, loader):
    if key not in _loaded:
        logger.info('Loading %s', ' / '.join(str(part) for part in key))
        _loaded[key] = loader()
    return _loaded[key]


def release():
    if not _loaded:
        return
    _loaded.clear()
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
