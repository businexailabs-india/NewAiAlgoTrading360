import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CredentialSchema, McpProvider } from '@/api/mcpProviders';
import { isSensitiveCredentialKey, maskSecret } from '@/api/mcpProviders';
import { CredentialInput } from './CredentialInput';
import { ConnectionTestResult } from './ConnectionTestResult';
import { LiveTradingLockedBanner } from './LiveTradingLockedBanner';
import {
  DEFAULT_PERMISSIONS,
  ProviderPermissionSelector,
} from './ProviderPermissionSelector';
import { MaskedSecretField } from './MaskedSecretField';

const STEPS = ['Overview', 'Credentials', 'Permissions', 'Test', 'Confirm'] as const;

export function ProviderConnectWizard({
  provider,
  credentialSchema,
  onValidate,
  onCreateAndTest,
  onSave,
  onCancel,
}: {
  provider: McpProvider;
  credentialSchema?: CredentialSchema | null;
  onValidate?: (credentials: Record<string, string>) => Promise<void>;
  onCreateAndTest: (args: {
    credentials: Record<string, string>;
    permissions: Record<string, boolean>;
    accountAlias: string;
  }) => Promise<{ connectionId: string; testResult: Record<string, unknown> }>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [alias, setAlias] = useState(`${provider.provider_name} Account`);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const fields = useMemo(() => {
    if (credentialSchema?.fields?.length) return credentialSchema.fields;
    const required = credentialSchema?.required || credentialSchema?.credentials_required || provider.credentials_required || [];
    const optional = credentialSchema?.optional || [];
    return [
      ...required.map((name) => ({ name, required: true, sensitive: isSensitiveCredentialKey(name) })),
      ...optional.map((name) => ({ name, required: false, sensitive: isSensitiveCredentialKey(name) })),
    ];
  }, [credentialSchema, provider.credentials_required]);

  const missingRequired = fields
    .filter((f) => f.required)
    .some((f) => !String(credentials[f.name] || '').trim());

  const next = async () => {
    setError(null);
    if (step === 1) {
      if (missingRequired) {
        setError('Fill all required credential fields.');
        return;
      }
      if (onValidate) {
        try {
          setBusy(true);
          await onValidate(credentials);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Validation failed');
          return;
        } finally {
          setBusy(false);
        }
      }
    }
    if (step === 3) {
      try {
        setBusy(true);
        const out = await onCreateAndTest({ credentials, permissions, accountAlias: alias });
        setConnectionId(out.connectionId);
        setTestResult(out.testResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Test failed');
        setTestResult(null);
        return;
      } finally {
        setBusy(false);
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="space-y-4" data-testid="provider-connect-wizard">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`rounded-full px-3 py-1 text-xs ${
              i === step
                ? 'bg-cyan-600 text-white'
                : i < step
                  ? 'bg-emerald-900/50 text-emerald-200'
                  : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          <h3 className="text-lg font-semibold text-white">{provider.provider_name}</h3>
          <p className="text-sm text-zinc-400">
            Exchanges: {(provider.supported_exchanges || []).join(', ') || '—'}
          </p>
          <p className="text-sm text-zinc-400">
            Capabilities: {(provider.capabilities || []).slice(0, 12).join(', ')}
          </p>
          <LiveTradingLockedBanner />
          <p className="text-xs text-amber-200/90">
            Compliance: credentials are encrypted at rest via the connector service. Raw secrets are
            never sent to DhanLaxmi or AI Advisory.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          {fields.map((f) => (
            <CredentialInput
              key={f.name}
              name={f.name}
              label={f.label}
              value={credentials[f.name] || ''}
              required={f.required}
              sensitive={f.sensitive}
              onChange={(name, value) => setCredentials((c) => ({ ...c, [name]: value }))}
            />
          ))}
          <CredentialInput
            name="account_alias"
            label="Connection alias"
            value={alias}
            onChange={(_, v) => setAlias(v)}
          />
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          <ProviderPermissionSelector value={permissions} onChange={setPermissions} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Click Next to create the connection and run POST /mcp/connections/&#123;id&#125;/test.
          </p>
          {(testResult || error) && <ConnectionTestResult result={testResult} error={error} />}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          <ConnectionTestResult result={testResult} error={error} />
          <p className="text-sm text-zinc-300">
            Connection ID: <span className="font-mono text-cyan-300">{connectionId || '—'}</span>
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(credentials).map(([k, v]) => (
              <MaskedSecretField
                key={k}
                label={k}
                value={isSensitiveCredentialKey(k) ? maskSecret(v) : v}
              />
            ))}
          </div>
          <p className="text-sm text-amber-200">
            Live trading remains disabled unless explicitly approved through RMS/OMS policy.
          </p>
          <LiveTradingLockedBanner compact />
        </div>
      )}

      {error && step !== 3 && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button disabled={busy} onClick={next}>
              {busy ? 'Working…' : 'Next'}
            </Button>
          ) : (
            <Button disabled={busy} onClick={onSave}>
              Save connection
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
