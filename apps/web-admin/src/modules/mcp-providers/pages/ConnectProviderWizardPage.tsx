import { validateProviderConfig } from '@/api/mcpProviders';
import {
  useProvider,
  useProviderRequiredCredentials,
  useCreateConnection,
  useTestConnection,
  mcpKeys,
} from '@/hooks/mcp';
import { ProviderConnectWizard } from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function ConnectProviderWizardPage() {
  const providerId = useMcpNavStore((s) => s.providerId);
  const go = useMcpNavStore((s) => s.go);
  const { data: provider } = useProvider(providerId);
  const { data: schema } = useProviderRequiredCredentials(providerId);
  const create = useCreateConnection();
  const test = useTestConnection();
  const qc = useQueryClient();

  if (!providerId || !provider) {
    return (
      <p className="text-zinc-400">
        Missing provider.{' '}
        <button className="text-cyan-400" onClick={() => go('marketplace')}>
          Back
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="mcp-connect-page">
      <h2 className="text-2xl font-bold text-white">Connect {provider.provider_name}</h2>
      <ProviderConnectWizard
        provider={provider}
        credentialSchema={schema}
        onValidate={async (credentials) => {
          await validateProviderConfig(providerId, { credentials });
        }}
        onCreateAndTest={async ({ credentials, permissions, accountAlias }) => {
          // Prefer mock for Dhan/local until live HTTP allowed
          const created = await create.mutateAsync({
            providerId,
            credentials,
            permissions,
            accountAlias,
            config: {
              use_mock: true,
              dhanlaxmi_visible: true,
              advisory_visible: true,
            },
          });
          const connectionId = created.connection?.id;
          if (!connectionId) throw new Error('No connection id returned');
          const testResult = (await test.mutateAsync(connectionId)) as Record<string, unknown>;
          return { connectionId, testResult };
        }}
        onSave={() => {
          qc.invalidateQueries({ queryKey: mcpKeys.connections() });
          toast.success('Connection saved. Live trading remains locked.');
          go('connections');
        }}
        onCancel={() => go('detail', { providerId })}
      />
    </div>
  );
}
