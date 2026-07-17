"""OpenTelemetry + Prometheus helpers."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Iterator

from prometheus_client import Counter, Histogram, start_http_server

logger = logging.getLogger("advisory.telemetry")

advisory_generation_count = Counter(
    "advisory_generation_count", "Advisory generations started", ["status"]
)
advisory_generation_latency = Histogram(
    "advisory_generation_latency", "Advisory generation latency seconds"
)
advisory_generation_failure_count = Counter(
    "advisory_generation_failure_count", "Advisory generation failures"
)
recommendations_generated_count = Counter(
    "recommendations_generated_count", "Recommendations generated"
)
strategies_converted_count = Counter("strategies_converted_count", "Strategies converted from advisory")
paper_tests_started_count = Counter("paper_tests_started_count", "Paper tests started")
paper_tests_completed_count = Counter(
    "paper_tests_completed_count", "Paper tests completed", ["status"]
)
live_approval_requested_count = Counter(
    "live_approval_requested_count", "Live approval requests"
)
external_algos_discovered_count = Counter(
    "external_algos_discovered_count", "External algos discovered"
)
external_algos_rejected_count = Counter(
    "external_algos_rejected_count", "External algos rejected"
)


def start_metrics_server(port: int = 9100) -> None:
    try:
        start_http_server(port)
        logger.info("prometheus_metrics_listening", extra={"port": port})
    except OSError:
        logger.warning("prometheus_port_in_use", extra={"port": port})


@contextmanager
def timed_generation() -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
        advisory_generation_count.labels(status="ok").inc()
    except Exception:
        advisory_generation_count.labels(status="error").inc()
        advisory_generation_failure_count.inc()
        raise
    finally:
        advisory_generation_latency.observe(time.perf_counter() - start)


def configure_logging(service_name: str) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='{"service":"%(name)s","level":"%(levelname)s","message":"%(message)s"}',
    )
    logging.getLogger().name = service_name
