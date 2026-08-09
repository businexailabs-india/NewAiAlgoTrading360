# Webhook Security Guide

- Secrets are stored as SHA-256 hashes only (`secretHint` = last 4 chars).
- Every webhook must include `secret` (body) or `x-tv-secret` header.
- Duplicate alerts (same connection + symbol/side/type/minute bucket) return HTTP 409.
- Stale alerts (>5 minutes old or >1 minute in the future) are rejected.
- Raw payloads are stored redacted (secret stripped).
- All events write `alert_audit_logs`.
- Broker credentials are never accepted or returned by TradingView APIs.
