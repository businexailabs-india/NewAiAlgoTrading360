from contextlib import contextmanager
from time import perf_counter

from prometheus_client import Counter, Histogram

voice_commands_total = Counter("dhanlaxmi_voice_commands_total", "Voice commands")
stt_latency = Histogram("dhanlaxmi_stt_latency", "STT latency seconds")
tts_latency = Histogram("dhanlaxmi_tts_latency", "TTS latency seconds")


@contextmanager
def timed(histogram: Histogram):
    start = perf_counter()
    try:
        yield
    finally:
        histogram.observe(perf_counter() - start)
