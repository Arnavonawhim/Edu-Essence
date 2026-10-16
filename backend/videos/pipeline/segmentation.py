import zlib
from dataclasses import dataclass
from statistics import mean

from django.conf import settings

SENTENCE_ENDINGS = ('.', '?', '!', '।', '॥', '。', '？', '！', '؟')
CLAUSE_ENDINGS = (',', ';', ':', '،', '、', '，', '—')
TRAILING_QUOTES = '"\'”’)]»'
LANGUAGES_WITHOUT_SPACES = {'zh', 'ja'}

HALLUCINATION_COMPRESSION_RATIO = 2.4
SENTENCE_PAUSE_SECONDS = 1.2
MERGE_GAP_SECONDS = 0.5
CLAUSE_BONUS = 0.5
BALANCE_WEIGHT = 0.5


@dataclass
class Word:
    text: str
    start: float
    end: float
    score: float | None = None

    @property
    def bare(self):
        return self.text.rstrip(TRAILING_QUOTES)

    def as_dict(self, offset):
        return {
            'word': self.text,
            'start': round(self.start + offset, 3),
            'end': round(self.end + offset, 3),
            'score': None if self.score is None else round(self.score, 3),
        }


def build_segments(raw_segments, language, offset=0.0):
    words = collect_words(raw_segments, language)
    groups = split_sentences(words)
    groups = [piece for group in groups for piece in split_long(group)]
    groups = merge_short(groups)
    return [as_segment(group, language, offset) for group in groups]


def is_hallucination(text):
    encoded = text.strip().encode('utf-8')
    if not encoded:
        return True
    return len(encoded) / len(zlib.compress(encoded)) > HALLUCINATION_COMPRESSION_RATIO


def collect_words(raw_segments, language):
    words = []
    for segment in raw_segments:
        if is_hallucination(segment.get('text', '')):
            continue

        raw_words = [word for word in segment.get('words', []) if word.get('word', '').strip()]
        if raw_words:
            words.extend(timed_words(raw_words, segment['start'], segment['end']))
        else:
            words.extend(estimated_words(segment, language))
    return words


def timed_words(raw_words, segment_start, segment_end):
    timed = []
    for position, word in enumerate(raw_words):
        start = word.get('start')
        end = word.get('end')

        if start is None:
            start = timed[-1].end if timed else segment_start
        if end is None:
            end = next(
                (later['start'] for later in raw_words[position + 1:] if later.get('start') is not None),
                segment_end,
            )

        score = word.get('score')
        timed.append(Word(
            word['word'].strip(),
            float(start),
            float(max(start, end)),
            None if score is None else float(score),
        ))
    return timed


def estimated_words(segment, language):
    text = segment['text'].strip()
    tokens = list(text.replace(' ', '')) if language in LANGUAGES_WITHOUT_SPACES else text.split()
    total_characters = sum(len(token) for token in tokens)
    if not total_characters:
        return []

    duration = segment['end'] - segment['start']
    cursor = segment['start']
    words = []
    for token in tokens:
        span = duration * len(token) / total_characters
        words.append(Word(token, cursor, cursor + span))
        cursor += span
    return words


def split_sentences(words):
    groups = []
    current = []
    for word in words:
        if current and word.start - current[-1].end >= SENTENCE_PAUSE_SECONDS:
            groups.append(current)
            current = []

        current.append(word)

        if word.bare.endswith(SENTENCE_ENDINGS):
            groups.append(current)
            current = []

    if current:
        groups.append(current)
    return groups


def split_long(group):
    if len(group) < 2 or duration(group) <= settings.DUBBING_MAX_SEGMENT_SECONDS:
        return [group]

    cut = max(range(1, len(group)), key=lambda position: boundary_score(group, position))
    return split_long(group[:cut]) + split_long(group[cut:])


def boundary_score(group, position):
    before = group[position - 1]
    after = group[position]

    gap = max(after.start - before.end, 0.0)
    clause = CLAUSE_BONUS if before.bare.endswith(CLAUSE_ENDINGS) else 0.0
    elapsed = (before.end - group[0].start) / duration(group)
    balance = 1 - abs(0.5 - elapsed) * 2

    return gap + clause + balance * BALANCE_WEIGHT


def merge_short(groups):
    merged = []
    for group in groups:
        if merged and should_merge(merged[-1], group):
            merged[-1] = merged[-1] + group
        else:
            merged.append(group)
    return merged


def should_merge(previous, group):
    gap = group[0].start - previous[-1].end
    combined = group[-1].end - previous[0].start

    if gap > MERGE_GAP_SECONDS or combined > settings.DUBBING_MAX_SEGMENT_SECONDS:
        return False

    minimum = settings.DUBBING_MIN_SEGMENT_SECONDS
    return duration(group) < minimum or duration(previous) < minimum


def as_segment(group, language, offset):
    joiner = '' if language in LANGUAGES_WITHOUT_SPACES else ' '
    scores = [word.score for word in group if word.score is not None]

    return {
        'start': round(group[0].start + offset, 3),
        'end': round(group[-1].end + offset, 3),
        'text': joiner.join(word.text for word in group),
        'words': [word.as_dict(offset) for word in group],
        'confidence': round(mean(scores), 3) if scores else None,
    }


def duration(group):
    return group[-1].end - group[0].start
