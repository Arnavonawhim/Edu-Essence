LANGUAGES = {
    'en': {
        'name': 'English',
        'native_name': 'English',
        'whisper': 'en',
        'gtts': 'en',
        'sarvam': 'en-IN',
    },
    'hi': {
        'name': 'Hindi',
        'native_name': 'हिन्दी',
        'whisper': 'hi',
        'gtts': 'hi',
        'sarvam': 'hi-IN',
    },
    'mr': {
        'name': 'Marathi',
        'native_name': 'मराठी',
        'whisper': 'mr',
        'gtts': 'mr',
        'sarvam': 'mr-IN',
    },
    'bn': {
        'name': 'Bengali',
        'native_name': 'বাংলা',
        'whisper': 'bn',
        'gtts': 'bn',
        'sarvam': 'bn-IN',
    },
    'ta': {
        'name': 'Tamil',
        'native_name': 'தமிழ்',
        'whisper': 'ta',
        'gtts': 'ta',
        'sarvam': 'ta-IN',
    },
    'te': {
        'name': 'Telugu',
        'native_name': 'తెలుగు',
        'whisper': 'te',
        'gtts': 'te',
        'sarvam': 'te-IN',
    },
    'kn': {
        'name': 'Kannada',
        'native_name': 'ಕನ್ನಡ',
        'whisper': 'kn',
        'gtts': 'kn',
        'sarvam': 'kn-IN',
    },
    'gu': {
        'name': 'Gujarati',
        'native_name': 'ગુજરાતી',
        'whisper': 'gu',
        'gtts': 'gu',
        'sarvam': 'gu-IN',
    },
}

LANGUAGE_CHOICES = [(code, config['name']) for code, config in LANGUAGES.items()]


def is_supported(code):
    return code in LANGUAGES


def get_language(code):
    return LANGUAGES[code]


def provider_code(code, provider):
    return LANGUAGES[code][provider]


def language_name(code):
    return LANGUAGES[code]['name']
