def srt_timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}'


def build_srt(segments, field='text'):
    blocks = [
        f'{number}\n{srt_timestamp(segment.start)} --> {srt_timestamp(segment.end)}\n{getattr(segment, field)}\n'
        for number, segment in enumerate(segments, start=1)
    ]
    return '\n'.join(blocks)
