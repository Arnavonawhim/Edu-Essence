from dataclasses import dataclass
from functools import lru_cache

import regex
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory
from indicnlp.tokenize import indic_tokenize
from indicnlp.transliterate.unicode_transliterate import UnicodeIndicTransliterator
from sacremoses import MosesDetokenizer

FLORES_TO_ISO = {
    'ben_Beng': 'bn',
    'guj_Gujr': 'gu',
    'hin_Deva': 'hi',
    'kan_Knda': 'kn',
    'mal_Mlym': 'ml',
    'mar_Deva': 'mr',
    'pan_Guru': 'pa',
    'tam_Taml': 'ta',
    'tel_Telu': 'te',
    'urd_Arab': 'ur',
}
UNTRANSLITERATED_SCRIPTS = {'Arab', 'Aran', 'Olck', 'Mtei', 'Latn'}

DIGIT_ZEROS = (0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x1C50, 0xABF0)
ASCII_DIGITS = str.maketrans({chr(zero + digit): str(digit) for zero in DIGIT_ZEROS for digit in range(10)})

PUNCTUATION_RULES = [
    (regex.compile(r'\r'), ''),
    (regex.compile(r'\(\s*'), '('),
    (regex.compile(r'\s*\)'), ')'),
    (regex.compile(r'\s:\s?'), ':'),
    (regex.compile(r'\s;\s?'), ';'),
    (regex.compile('[`\u00b4\u2018\u201a\u2019]'), "'"),
    (regex.compile('[\u201e\u201c\u201d\u00ab\u00bb]'), '"'),
    (regex.compile('[\u2013\u2014]'), '-'),
    (regex.compile('\u00a0%'), '%'),
    (regex.compile('n\u00ba\u00a0'), 'n\u00ba '),
    (regex.compile('\u00a0\u00baC'), ' \u00baC'),
    (regex.compile('\u00a0([?!;])'), r'\1'),
    (regex.compile(',\u00a0'), ', '),
    (regex.compile(r'[ ]{2,}'), ' '),
    (regex.compile(r'\) ([\.!:?;,])'), r')\1'),
    (regex.compile(r'(\d) %'), r'\1%'),
    (regex.compile(r'"([,\.]+)'), r'\1"'),
    (regex.compile('(\\d)\u00a0(\\d)'), r'\1.\2'),
]

EMAIL_PATTERN = regex.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}')
URL_PATTERN = regex.compile(
    r'\b(?<![\w/.])(?:(?:https?|ftp)://)?(?:(?:[\w-]+\.)+(?!\.))(?:[\w/\-?#&=%.]+)+(?!\.\w+)\b'
)
NUMERAL_PATTERN = regex.compile(
    r"(~?\d+\.?\d*\s?%?\s?-?\s?~?\d+\.?\d*\s?%|~?\d+%|\d+[-\/.,:']\d+[-\/.,:'+]\d+(?:\.\d+)?|\d+[-\/.:'+]\d+(?:\.\d+)?)"
)
HANDLE_PATTERN = regex.compile(r'[A-Za-z0-9]*[#|@]\w+')
PLACEHOLDER_PATTERNS = (EMAIL_PATTERN, URL_PATTERN, NUMERAL_PATTERN, HANDLE_PATTERN)
WHITESPACE = regex.compile(r'\s+')

DETOKENIZER = MosesDetokenizer(lang='en')


@dataclass
class PreparedText:
    text: str
    placeholders: dict


def preprocess_indic(text, source_code, target_code):
    iso_code = FLORES_TO_ISO.get(source_code, 'hi')
    script = source_code.split('_')[1]

    text = normalize_punctuation(text).translate(ASCII_DIGITS)
    text, placeholders = wrap_placeholders(text)

    normalized = normalizer_for(iso_code).normalize(text.strip())
    tokens = ' '.join(indic_tokenize.trivial_tokenize(normalized, iso_code))
    if script not in UNTRANSLITERATED_SCRIPTS:
        tokens = UnicodeIndicTransliterator.transliterate(tokens, iso_code, 'hi').replace(' ् ', '्')

    return PreparedText(f'{source_code} {target_code} {tokens.strip()}', placeholders)


def postprocess_english(text, placeholders):
    for placeholder, original in placeholders.items():
        text = text.replace(placeholder, original)
    return DETOKENIZER.detokenize(text.split(' '))


def normalize_punctuation(text):
    for pattern, replacement in PUNCTUATION_RULES:
        text = pattern.sub(replacement, text)
    return text.strip()


def wrap_placeholders(text):
    placeholders = {}
    serial = 1

    for pattern in PLACEHOLDER_PATTERNS:
        for match in dict.fromkeys(pattern.findall(text)):
            if pattern is URL_PATTERN and len(match.replace('.', '')) < 4:
                continue
            if pattern is NUMERAL_PATTERN and len(match.replace(' ', '').replace('.', '').replace(':', '')) < 4:
                continue

            for variant in placeholder_variants(serial):
                placeholders[variant] = match
            text = text.replace(match, f'<ID{serial}>')
            serial += 1

    text = WHITESPACE.sub(' ', text).replace('>/', '>').replace(']/', ']')
    return text, placeholders


def placeholder_variants(serial):
    for tag in ('ID', 'id'):
        yield from (
            f'<{tag}{serial}>',
            f'< {tag}{serial} >',
            f'[{tag}{serial}]',
            f'[ {tag}{serial} ]',
            f'[{tag} {serial}]',
            f'<{tag}{serial}]',
            f'< {tag}{serial}]',
            f'<{tag}{serial} ]',
        )


@lru_cache(maxsize=None)
def normalizer_for(iso_code):
    return IndicNormalizerFactory().get_normalizer(iso_code)
