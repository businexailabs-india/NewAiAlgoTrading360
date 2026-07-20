# Provider Certification — Accord Fintech ACE Datafeed (`accord`)

- Phase: `phase_2_real_provider_readiness`
- Generated: `2026-07-19T05:34:05.855741+00:00`
- Mode: `mock`
- Score: **100.0%**
- Overall: **PASS**

| Item | Passed | Evidence |
|------|--------|----------|
| `credentials_configured` | ✅ | schema_only |
| `sandbox_mock_tested` | ✅ | connected |
| `account_profile_tested` | ✅ | profile_ok |
| `margin_tested` | ✅ | available=100000.0 |
| `holdings_tested` | ✅ | count=0 |
| `positions_tested` | ✅ | count=0 |
| `quote_tested` | ✅ | symbols=['NSE:RELIANCE'] |
| `order_preview_tested` | ✅ | market_data_no_trade |
| `rms_integration_tested` | ✅ | gate_enforced |
| `oms_integration_tested` | ✅ | gate_enforced |
| `live_execution_disabled_by_default` | ✅ | blocked |
| `audit_logging_verified` | ✅ | hook_or_default |
| `security_redaction_verified` | ✅ | redact_secrets_ok |
