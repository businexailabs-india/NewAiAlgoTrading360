# Credential Security Guide

## SecretManager backends

| Provider | Env value | Status |
|----------|-----------|--------|
| LocalEncryptedSecretManager | `local_encrypted` | Dev default |
| VaultSecretManager | `vault` | Placeholder |
| AWSSecretsManager | `aws` | Placeholder |
| GCPSecretManager | `gcp` | Placeholder |
| AzureKeyVault | `azure` | Placeholder |

```
SECRET_MANAGER_PROVIDER=local_encrypted
LOCAL_SECRET_KEY=change-this-in-production
```

## Rules

- Never log raw credentials
- Never return raw credentials from API (masked only)
- Never send secrets to LLMs / DhanLaxmi prompts
- Rotate via `SecretManager.rotate`
- Validate schema per provider before connect
- Redact broker responses that may embed tokens (`advisory_core.security.redact_secrets`)
- Tenant isolation on every connection lookup
