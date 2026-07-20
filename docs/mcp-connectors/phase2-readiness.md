# Phase 2 — Real Provider Readiness

Each Indian broker/market-data adapter now includes:

| Module | Purpose |
|--------|---------|
| `dtos.py` | Adapter-specific request/response DTOs |
| `errors.py` | Broker error → `ProviderErrorCode` mapping |
| `rate_limits.py` | Conservative RPS / order throttles |
| `auth.py` | Auth refresh flow placeholder (`live_http=false`) |
| `fixtures.py` | Sample mock HTTP fixtures |
| `provider.py` | Method stubs + normalization via `Phase2BrokerProvider` |

## Live HTTP policy

Real broker HTTP is **never** called unless **all** are true:

1. Required env credentials are set  
2. Provider base URL env is set (`DHAN_BASE_URL`, `ZERODHA_BASE_URL`, …)  
3. `PROVIDER_ALLOW_LIVE_HTTP=true` **or** `<PROVIDER>_ALLOW_LIVE_HTTP=true`

Otherwise adapters run on mock fixtures (`mode=mock` or `credentials_configured_mock`).

## Certification checklist

`ProviderCertificationChecklist` covers:

- credentials configured  
- sandbox/mock tested  
- account profile / margin / holdings / positions / quote tested  
- order preview tested  
- RMS + OMS gate tested  
- live execution disabled by default  
- audit logging verified  
- security redaction verified  

### Generate reports

```bash
python scripts/run_provider_certification.py
# or one provider:
python scripts/run_provider_certification.py --provider dhan
```

Reports: `reports/provider-certification/`
- `SUMMARY.md` / `SUMMARY.json`
- `<provider_id>-latest.md` / `.json`
