"""Prometheus metrics for DhanLaxmi."""

from __future__ import annotations

from contextlib import contextmanager
from time import perf_counter

from prometheus_client import Counter, Histogram

commands_total = Counter(
    "dhanlaxmi_commands_total", "Total DhanLaxmi commands", ["mode"]
)
voice_commands_total = Counter("dhanlaxmi_voice_commands_total", "Voice commands")
intent_latency = Histogram("dhanlaxmi_intent_detection_latency", "Intent detection seconds")
llm_latency = Histogram("dhanlaxmi_llm_latency", "LLM latency seconds")
stt_latency = Histogram("dhanlaxmi_stt_latency", "STT latency seconds")
tts_latency = Histogram("dhanlaxmi_tts_latency", "TTS latency seconds")
trade_approvals_requested = Counter(
    "dhanlaxmi_trade_approvals_requested", "Trade approvals requested"
)
trade_approvals_approved = Counter(
    "dhanlaxmi_trade_approvals_approved", "Trade approvals approved by user"
)
trade_approvals_rejected = Counter(
    "dhanlaxmi_trade_approvals_rejected", "Trade approvals rejected"
)
blocked_live_trades = Counter("dhanlaxmi_blocked_live_trades", "Blocked live trade attempts")
guardrail_triggers = Counter(
    "dhanlaxmi_guardrail_triggers_total", "Guardrail triggers", ["code"]
)


@contextmanager
def timed(histogram: Histogram):
    start = perf_counter()
    try:
        yield
    finally:
        histogram.observe(perf_counter() - start)
