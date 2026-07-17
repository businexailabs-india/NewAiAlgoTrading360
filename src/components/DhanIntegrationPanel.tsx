import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Shield, Server, Link2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  integrationService,
  BrokerAccountView,
  ExecutionContextView,
  FeatureStatus,
  McpServerView
} from '../services/integrationService';

export function DhanIntegrationPanel() {
  const [status, setStatus] = useState<FeatureStatus | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServerView[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccountView[]>([]);
  const [context, setContext] = useState<ExecutionContextView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [mcpForm, setMcpForm] = useState({
    name: 'Dhan MCP',
    endpoint: '',
    transport: 'HTTP',
    authHeader: ''
  });
  const [dhanForm, setDhanForm] = useState({
    displayName: 'Dhan Primary',
    clientId: '',
    accessToken: '',
    providerType: 'DIRECT' as 'DIRECT' | 'MCP',
    mcpServerConfigId: ''
  });

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [st, servers, accs, ctx] = await Promise.all([
        integrationService.getStatus(),
        integrationService.listMcpServers(),
        integrationService.listAccounts(),
        integrationService.getExecutionContext()
      ]);
      setStatus(st);
      setMcpServers(servers);
      setAccounts(accs);
      setContext(ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createMcp = async () => {
    setBusy(true);
    setMsg('');
    try {
      const headers = mcpForm.authHeader
        ? { Authorization: mcpForm.authHeader }
        : undefined;
      await integrationService.createMcpServer({
        name: mcpForm.name,
        endpoint: mcpForm.endpoint,
        transport: mcpForm.transport,
        headers
      });
      setMsg('MCP server saved');
      setMcpForm(f => ({ ...f, endpoint: '', authHeader: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MCP create failed');
    } finally {
      setBusy(false);
    }
  };

  const testMcp = async (id: string) => {
    setBusy(true);
    try {
      await integrationService.testMcpServer(id);
      setMsg('MCP health probe complete');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MCP test failed');
    } finally {
      setBusy(false);
    }
  };

  const saveDhan = async () => {
    setBusy(true);
    try {
      const account = await integrationService.upsertDhanAccount({
        displayName: dhanForm.displayName,
        clientId: dhanForm.clientId,
        accessToken: dhanForm.accessToken,
        providerType: dhanForm.providerType,
        mcpServerConfigId: dhanForm.mcpServerConfigId || undefined
      });
      setMsg('Dhan account saved (encrypted in DB)');
      setDhanForm(f => ({ ...f, accessToken: '', clientId: '' }));
      await load();
      // Auto-sync portfolio so holdings appear in UI
      try {
        const sync = await integrationService.syncAccountPortfolio(account.id);
        setMsg(`Account saved · synced ${sync.holdingsCount} holdings`);
      } catch (syncErr) {
        setError(syncErr instanceof Error ? syncErr.message : 'Saved, but portfolio sync failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account save failed');
    } finally {
      setBusy(false);
    }
  };

  const syncPortfolio = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const sync = await integrationService.syncAccountPortfolio(id);
      setMsg(`Synced ${sync.holdingsCount} holdings · ₹${Math.round(sync.totalCurrent).toLocaleString('en-IN')} current`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portfolio sync failed');
    } finally {
      setBusy(false);
    }
  };

  const bootstrapEnv = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await integrationService.bootstrapEnvDhan();
      setMsg(`Imported from .env · synced ${result.sync.holdingsCount} holdings`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Env bootstrap failed');
    } finally {
      setBusy(false);
    }
  };

  const selectAccount = async (id: string) => {
    if (!context) return;
    setBusy(true);
    try {
      await integrationService.updateExecutionContext({
        activeBrokerConnectionId: id,
        expectedVersion: context.context.version
      });
      setMsg('Active account selected');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Selection failed');
    } finally {
      setBusy(false);
    }
  };

  const setMode = async (executionMode: 'PAPER' | 'LIVE') => {
    if (!context) return;
    setBusy(true);
    try {
      await integrationService.updateExecutionContext({
        executionMode,
        expectedVersion: context.context.version
      });
      setMsg(`Execution mode set to ${executionMode}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mode update failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleKillSwitch = async (on: boolean) => {
    setBusy(true);
    try {
      await integrationService.adminUpdateTradingControl({
        scope: 'GLOBAL',
        killSwitch: on
      });
      setMsg(on ? 'Kill switch ON — live orders blocked' : 'Kill switch OFF');
      await load();
    } catch (e) {
      // Fallback for non-admin local user
      try {
        await integrationService.updateTradingControl({ scope: 'USER', killSwitch: on });
        setMsg(on ? 'User kill switch ON' : 'User kill switch OFF');
        await load();
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : 'Kill switch update failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const approveLive = async (enabled: boolean) => {
    setBusy(true);
    try {
      await integrationService.adminUpdateTradingControl({
        scope: 'GLOBAL',
        liveTradingEnabled: enabled,
        approvalState: enabled ? 'APPROVED' : 'REVOKED'
      });
      setMsg(enabled
        ? 'Global live trading approved (still needs LIVE_TRADING_ENABLED=true in env)'
        : 'Global live trading revoked');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval update failed — admin role required');
    } finally {
      setBusy(false);
    }
  };

  const caps = status?.capabilityCatalog || [];
  const selectedCaps = (status?.capabilities || {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" /> Dhan MCP & Account Execution
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure MCP endpoint, Dhan accounts, active selection, and paper-first live controls.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={busy}>
          <RefreshCw className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}
      {msg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{msg}</div>
      )}

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="Env Live Gate" ok={!!status?.liveTradingEnvEnabled} detail={status?.liveTradingEnvEnabled ? 'ENABLED' : 'DISABLED'} />
        <StatusCard label="Global Live" ok={!!status?.globalLiveEnabled} detail={status?.globalLiveEnabled ? 'APPROVED' : 'OFF'} />
        <StatusCard label="Kill Switch" ok={!status?.killSwitch} detail={status?.killSwitch ? 'ACTIVE' : 'CLEAR'} invert />
        <StatusCard label="Mode" ok={status?.executionMode === 'PAPER'} detail={status?.executionMode || '—'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* MCP config */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-white flex items-center gap-2"><Link2 className="w-4 h-4" /> MCP Servers</h3>
          <Input placeholder="Name" value={mcpForm.name} onChange={e => setMcpForm({ ...mcpForm, name: e.target.value })} />
          <Input placeholder="HTTP/SSE endpoint URL" value={mcpForm.endpoint} onChange={e => setMcpForm({ ...mcpForm, endpoint: e.target.value })} />
          <Input placeholder="Optional Authorization header" value={mcpForm.authHeader} onChange={e => setMcpForm({ ...mcpForm, authHeader: e.target.value })} />
          <Button onClick={createMcp} disabled={busy || !mcpForm.endpoint}>Save MCP Server</Button>

          <div className="space-y-2 mt-4">
            {mcpServers.length === 0 && <p className="text-gray-400 text-sm">No MCP servers configured</p>}
            {mcpServers.map(s => (
              <div key={s.id} className="p-3 rounded-lg bg-black/30 border border-white/5 flex items-start justify-between gap-2">
                <div>
                  <div className="text-white text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-gray-400 break-all">{s.endpoint}</div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{s.lastHealthStatus || 'UNKNOWN'}</Badge>
                    {s.latencyMs != null && <Badge variant="outline">{s.latencyMs}ms</Badge>}
                    <Badge variant="outline">{Array.isArray(s.discoveredTools) ? s.discoveredTools.length : 0} tools</Badge>
                  </div>
                  {s.lastError && <p className="text-xs text-red-300 mt-1">{s.lastError}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => testMcp(s.id)} disabled={busy}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await integrationService.deleteMcpServer(s.id); await load(); }}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dhan account */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-white flex items-center gap-2"><Shield className="w-4 h-4" /> Dhan Accounts</h3>
          <Input placeholder="Display name" value={dhanForm.displayName} onChange={e => setDhanForm({ ...dhanForm, displayName: e.target.value })} />
          <Input placeholder="Client ID" value={dhanForm.clientId} onChange={e => setDhanForm({ ...dhanForm, clientId: e.target.value })} />
          <Input placeholder="Access token" type="password" value={dhanForm.accessToken} onChange={e => setDhanForm({ ...dhanForm, accessToken: e.target.value })} />
          <select
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
            value={dhanForm.providerType}
            onChange={e => setDhanForm({ ...dhanForm, providerType: e.target.value as 'DIRECT' | 'MCP' })}
          >
            <option value="DIRECT">DIRECT API</option>
            <option value="MCP">MCP (preferred when selected)</option>
          </select>
          {dhanForm.providerType === 'MCP' && (
            <select
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
              value={dhanForm.mcpServerConfigId}
              onChange={e => setDhanForm({ ...dhanForm, mcpServerConfigId: e.target.value })}
            >
              <option value="">Select MCP server</option>
              {mcpServers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveDhan} disabled={busy || !dhanForm.clientId || !dhanForm.accessToken}>Save & Sync Portfolio</Button>
            <Button variant="secondary" onClick={bootstrapEnv} disabled={busy}>Import from .env & Sync</Button>
          </div>
          <p className="text-xs text-gray-500">Portfolio UI only shows DB holdings — sync pulls live Dhan positions into the app.</p>

          <div className="space-y-2 mt-4">
            {accounts.length === 0 && <p className="text-gray-400 text-sm">No broker accounts</p>}
            {accounts.map(a => (
              <div key={a.id} className="p-3 rounded-lg bg-black/30 border border-white/5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white text-sm">{a.displayName || a.broker} <span className="text-gray-500">({a.broker})</span></div>
                    <div className="text-xs text-gray-400">Client {a.maskedClientId || '—'} · {a.providerType} · {a.status}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {context?.context.activeBrokerConnectionId === a.id
                      ? <Badge className="bg-cyan-500/20 text-cyan-300">SELECTED</Badge>
                      : <Button size="sm" variant="outline" onClick={() => selectAccount(a.id)}>Select</Button>}
                    <Button size="sm" variant="outline" onClick={async () => { await integrationService.validateAccount(a.id); await load(); }}>Validate</Button>
                    <Button size="sm" onClick={() => syncPortfolio(a.id)} disabled={busy}>Sync Portfolio</Button>
                  </div>
                </div>
                {a.lastError && <p className="text-xs text-red-300 mt-1">{a.lastError}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Execution controls */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-white">Execution Mode & Live Gate</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant={context?.context.executionMode === 'PAPER' ? 'default' : 'outline'} onClick={() => setMode('PAPER')}>Paper</Button>
          <Button variant={context?.context.executionMode === 'LIVE' ? 'default' : 'outline'} onClick={() => setMode('LIVE')}>Live (gated)</Button>
          <Button variant="destructive" onClick={() => toggleKillSwitch(true)}>Kill Switch ON</Button>
          <Button variant="outline" onClick={() => toggleKillSwitch(false)}>Kill Switch OFF</Button>
          <Button variant="outline" onClick={() => approveLive(true)}>Approve Live (Admin)</Button>
          <Button variant="ghost" onClick={() => approveLive(false)}>Revoke Live</Button>
        </div>
        <p className="text-xs text-gray-400">
          Live requires: LIVE_TRADING_ENABLED=true, global approval, no kill switch, selected healthy account, and explicit isPaper=false.
        </p>
      </section>

      {/* Capability matrix */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white mb-3">MCP / Dhan Capability Matrix</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {caps.map(c => {
            const available = selectedCaps[c.capability];
            return (
              <div key={c.capability} className="flex items-start gap-2 p-2 rounded bg-black/20 text-xs">
                {available ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-gray-500 mt-0.5" />}
                <div>
                  <div className="text-white">{c.capability}</div>
                  <div className="text-gray-500">{c.description}{c.liveRequired ? ' · live' : ''}</div>
                </div>
              </div>
            );
          })}
          {caps.length === 0 && <p className="text-gray-400 text-sm">Load status to see capabilities</p>}
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, ok, detail, invert }: { label: string; ok: boolean; detail: string; invert?: boolean }) {
  const good = invert ? !ok : ok;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-gray-400 flex items-center gap-1">
        {good ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
        {label}
      </div>
      <div className="text-white text-sm mt-1">{detail}</div>
    </div>
  );
}
