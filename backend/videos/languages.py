
INDICTRANS2 = 'indictrans2'
NLLB = 'nllb'

SOURCE_LANGUAGES = {
    'hi': {'name': 'Hindi', 'translator': INDICTRANS2, 'model_code': 'hin_Deva'},
    'mr': {'name': 'Marathi', 'translator': INDICTRANS2, 'model_code': 'mar_Deva'},
    'ta': {'name': 'Tamil', 'translator': INDICTRANS2, 'model_code': 'tam_Taml'},
    'te': {'name': 'Telugu', 'translator': INDICTRANS2, 'model_code': 'tel_Telu'},
    'bn': {'name': 'Bengali', 'translator': INDICTRANS2, 'model_code': 'ben_Beng'},
    'gu': {'name': 'Gujarati', 'translator': INDICTRANS2, 'model_code': 'guj_Gujr'},
    'kn': {'name': 'Kannada', 'translator': INDICTRANS2, 'model_code': 'kan_Knda'},
    'ml': {'name': 'Malayalam', 'translator': INDICTRANS2, 'model_code': 'mal_Mlym'},
    'pa': {'name': 'Punjabi', 'translator': INDICTRANS2, 'model_code': 'pan_Guru'},
    'ur': {'name': 'Urdu', 'translator': INDICTRANS2, 'model_code': 'urd_Arab'},
    'de': {'name': 'German', 'translator': NLLB, 'model_code': 'deu_Latn'},
    'fr': {'name': 'French', 'translator': NLLB, 'model_code': 'fra_Latn'},
    'es': {'name': 'Spanish', 'translator': NLLB, 'model_code': 'spa_Latn'},
    'it': {'name': 'Italian', 'translator': NLLB, 'model_code': 'ita_Latn'},
    'pt': {'name': 'Portuguese', 'translator': NLLB, 'model_code': 'por_Latn'},
    'nl': {'name': 'Dutch', 'translator': NLLB, 'model_code': 'nld_Latn'},
    'ru': {'name': 'Russian', 'translator': NLLB, 'model_code': 'rus_Cyrl'},
    'tr': {'name': 'Turkish', 'translator': NLLB, 'model_code': 'tur_Latn'},
    'ar': {'name': 'Arabic', 'translator': NLLB, 'model_code': 'arb_Arab'},
    'ja': {'name': 'Japanese', 'translator': NLLB, 'model_code': 'jpn_Jpan'},
    'ko': {'name': 'Korean', 'translator': NLLB, 'model_code': 'kor_Hang'},
    'zh': {'name': 'Chinese', 'translator': NLLB, 'model_code': 'zho_Hans'},
}

SOURCE_LANGUAGE_CHOICES = [(code, config['name']) for code, config in SOURCE_LANGUAGES.items()]


def is_supported(code):
    return code in SOURCE_LANGUAGES


def translator_for(code):
    return SOURCE_LANGUAGES[code]['translator']


def model_code(code):
    return SOURCE_LANGUAGES[code]['model_code']
