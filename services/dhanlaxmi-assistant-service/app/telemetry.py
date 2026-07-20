"""Prometheus metrics for DhanLaxmi."""

from __future__ import annotations

from contextlib import contextmanager
from time import perf_counter
from typing import Any

from prometheus_client import REGISTRY, Counter, Histogram


def _get_or_create_counter(name: str, documentation: str, labelnames: list[str] | None = None) -> Counter:
    existing = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
    if existing is not None:
        return existing  # type: ignore[return-value]
    return Counter(name, documentation, labelnames or [])


def _get_or_create_histogram(name: str, documentation: str) -> Histogram:
    existing = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
    if existing is not None:
        return existing  # type: ignore[return-value]
    return Histogram(name, documentation)


commands_total = _get_or_create_counter(
    "dhanlaxmi_commands_total", "Total DhanLaxmi commands", ["mode"]
)
voice_commands_total = _get_or_create_counter("dhanlaxmi_voice_commands_total", "Voice commands")
intent_latency = _get_or_create_histogram("dhanlaxmi_intent_detection_latency", "Intent detection seconds")
llm_latency = _get_or_create_histogram("dhanlaxmi_llm_latency", "LLM latency seconds")
stt_latency = _get_or_create_histogram("dhanlaxmi_stt_latency", "STT latency seconds")
tts_latency = _get_or_create_histogram("dhanlaxmi_tts_latency", "TTS latency seconds")
trade_approvals_requested = _get_or_create_counter(
    "dhanlaxmi_trade_approvals_requested", "Trade approvals requested"
)
trade_approvals_approved = _get_or_create_counter(
    "dhanlaxmi_trade_approvals_approved", "Trade approvals approved by user"
)
trade_approvals_rejected = _get_or_create_counter(
    "dhanlaxmi_trade_approvals_rejected", "Trade approvals rejected"
)
blocked_live_trades = _get_or_create_counter(
    "dhanlaxmi_blocked_live_trades", "Blocked live trade attempts"
)
guardrail_triggers = _get_or_create_counter(
    "dhanlaxmi_guardrail_triggers_total", "Guardrail triggers", ["code"]
)


@contextmanager
def timed(histogram: Any):
    start = perf_counter()
    try:
        yield
    finally:
        histogram.observe(perf_counter() - start)
