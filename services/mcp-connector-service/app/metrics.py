"""Prometheus metrics for MCP connector service."""

from __future__ import annotations

from typing import Any

from prometheus_client import REGISTRY, Counter, Histogram, start_http_server


def _counter(name: str, documentation: str, labelnames: list[str] | None = None) -> Counter:
    existing = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
    if existing is not None:
        return existing  # type: ignore[return-value]
    return Counter(name, documentation, labelnames or [])


def _histogram(
    name: str, documentation: str, labelnames: list[str] | None = None, **kwargs: Any
) -> Histogram:
    existing = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
    if existing is not None:
        return existing  # type: ignore[return-value]
    return Histogram(name, documentation, labelnames or [], **kwargs)


mcp_provider_connections_total = _counter(
    "mcp_provider_connections_total",
    "Total provider connections created",
    ["provider_id", "result"],
)
mcp_provider_connection_failures_total = _counter(
    "mcp_provider_connection_failures_total",
    "Provider connection failures",
    ["provider_id", "reason"],
)
mcp_provider_health_latency_ms = _histogram(
    "mcp_provider_health_latency_ms",
    "Provider health check latency ms",
    ["provider_id"],
    buckets=(1, 5, 10, 25, 50, 100, 250, 500, 1000, 3000),
)
mcp_provider_api_errors_total = _counter(
    "mcp_provider_api_errors_total",
    "Provider API errors",
    ["provider_id", "operation"],
)
mcp_provider_rate_limit_warnings_total = _counter(
    "mcp_provider_rate_limit_warnings_total",
    "Provider rate limit warnings",
    ["provider_id"],
)
mcp_quotes_received_total = _counter(
    "mcp_quotes_received_total",
    "Quotes received",
    ["provider_id"],
)
mcp_order_previews_total = _counter(
    "mcp_order_previews_total",
    "Order previews",
    ["provider_id"],
)
mcp_live_order_blocked_total = _counter(
    "mcp_live_order_blocked_total",
    "Live orders blocked by gates",
    ["provider_id", "reason"],
)
mcp_paper_orders_total = _counter(
    "mcp_paper_orders_total",
    "Paper orders executed",
    ["provider_id", "status"],
)


def start_metrics(port: int = 9104) -> None:
    try:
        start_http_server(port)
    except OSError:
        pass
