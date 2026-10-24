import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Shield, Server, Link2, CheckCircle, XCircle, AlertTriangle, Radar, PlusCircle } from 'lucide-react';
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
  const [indianScan, setIndianScan] = useState<{
    total: number;
    alreadyAdded: number;
    reachable: number;
    results: Array<{
      provider: string;
      name: string;
      endpoint: string;
      alreadyAdded: boolean;
      reachable: boolean;
      status: string;
      latencyMs: number | null;
      toolsCount: number;
      probeError: string | null;
      notes?: string;
    }>;
  } | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [fyersForm, setFyersForm] = useState({
    displayName: 'Fyers Primary',
    appId: '',
    accessToken: ''
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

  const scanIndianMcps = async () => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const data = await integrationService.scanIndianMcpServers({ probe: true });
      setIndianScan(data);
      setSelectedProviders(
        (data.results || [])
          .filter((r: { alreadyAdded: boolean; reachable: boolean }) => !r.alreadyAdded)
          .map((r: { provider: string }) => r.provider)
      );
      setMsg(
        `Scanned ${data.total} Indian MCP presets · ${data.reachable} reachable · ${data.alreadyAdded} already added`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Indian MCP scan failed');
    } finally {
      setBusy(false);
    }
  };

  const addSelectedIndianMcps = async (onlyReachable = false) => {
    setBusy(true);
    setError('');
    try {
      const data = await integrationService.addIndianMcpServers({
        providers: selectedProviders.length ? selectedProviders : undefined,
        onlyReachable,
        updateExisting: false,
        probeFirst: onlyReachable
      });
      setMsg(
        `Added ${data.summary?.created || 0} MCP server(s)` +
          (data.summary?.skipped ? ` · skipped ${data.summary.skipped}` : '')
      );
      setIndianScan(data.scan || null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add Indian MCPs failed');
    } finally {
      setBusy(false);
    }
  };

  const addAllIndianMcps = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await integrationService.addIndianMcpServers({
        onlyReachable: false,
        updateExisting: false,
        probeFirst: false
      });
      setMsg(
        `Added all catalog presets: ${data.summary?.created || 0} created · ${data.summary?.skipped || 0} skipped`
      );
      setIndianScan(data.scan || null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add all Indian MCPs failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders((prev) =>
      prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider]
    );
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

  const saveFyers = async () => {
    setBusy(true);
    try {
      const account = await integrationService.upsertFyersAccount({
        displayName: fyersForm.displayName,
        appId: fyersForm.appId,
        accessToken: fyersForm.accessToken,
        providerType: 'DIRECT'
      });
      setMsg('Fyers account saved (encrypted in DB)');
      setFyersForm((f) => ({ ...f, accessToken: '', appId: '' }));
      await load();
      try {
        const sync = await integrationService.syncAccountPortfolio(account.id);
        setMsg(`Fyers saved · synced ${sync.holdingsCount} holdings`);
      } catch (syncErr) {
        setError(syncErr instanceof Error ? syncErr.message : 'Saved, but portfolio sync failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fyers save failed');
    } finally {
      setBusy(false);
    }
  };

  const bootstrapEnvFyers = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await integrationService.bootstrapEnvFyers();
      setMsg(
        result.sync
          ? `Fyers imported from .env · synced ${result.sync.holdingsCount} holdings`
          : 'Fyers imported from .env (quotes enabled; holdings sync skipped)'
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fyers env bootstrap failed');
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

          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-cyan-100 flex items-center gap-2">
                  <Radar className="w-4 h-4" /> Indian Trading MCP Catalog
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Scan presets for Dhan, Zerodha, Angel One, Upstox, Groww, Fyers, and more. Override endpoints with{' '}
                  <code className="text-cyan-300/90">MCP_&lt;PROVIDER&gt;_URL</code> in backend env.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={scanIndianMcps} disabled={busy} className="bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">
                <Radar className="w-4 h-4 mr-2" />
                Scan Indian MCPs
              </Button>
              <Button onClick={() => addSelectedIndianMcps(false)} disabled={busy || selectedProviders.length === 0} variant="outline">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add selected ({selectedProviders.length})
              </Button>
              <Button onClick={() => addSelectedIndianMcps(true)} disabled={busy || !indianScan} variant="outline">
                Add reachable only
              </Button>
              <Button onClick={addAllIndianMcps} disabled={busy} variant="secondary">
                Add all Indian MCPs
              </Button>
            </div>

            {indianScan && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {indianScan.results.map((r) => (
                  <label
                    key={r.provider}
                    className="flex items-start gap-3 p-2 rounded-md bg-black/30 border border-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedProviders.includes(r.provider)}
                      disabled={r.alreadyAdded}
                      onChange={() => toggleProvider(r.provider)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white">{r.name}</span>
                        <Badge variant="outline">{r.status}</Badge>
                        {r.alreadyAdded && <Badge className="bg-emerald-500/20 text-emerald-300">Added</Badge>}
                        {r.reachable ? (
                          <Badge className="bg-cyan-500/20 text-cyan-300">Reachable{r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}</Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-200">Offline</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 break-all">{r.endpoint}</div>
                      {r.notes && <div className="text-[11px] text-gray-400 mt-0.5">{r.notes}</div>}
                      {r.probeError && !r.reachable && (
                        <div className="text-[11px] text-amber-300/80 mt-0.5 truncate" title={r.probeError}>{r.probeError}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

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

          <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
            <h3 className="text-white flex items-center gap-2"><Shield className="w-4 h-4" /> Fyers Accounts</h3>
            <p className="text-xs text-gray-400">
              App ID + access token from{' '}
              <a className="text-cyan-300 underline" href="https://myapi.fyers.in/" target="_blank" rel="noreferrer">
                myapi.fyers.in
              </a>
              . Set FYERS_APP_ID / FYERS_ACCESS_TOKEN in backend .env for index LTP without login.
            </p>
            <Input placeholder="Display name" value={fyersForm.displayName} onChange={(e) => setFyersForm({ ...fyersForm, displayName: e.target.value })} />
            <Input placeholder="Fyers App ID (client_id)" value={fyersForm.appId} onChange={(e) => setFyersForm({ ...fyersForm, appId: e.target.value })} />
            <Input placeholder="Access token" type="password" value={fyersForm.accessToken} onChange={(e) => setFyersForm({ ...fyersForm, accessToken: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveFyers} disabled={busy || !fyersForm.appId || !fyersForm.accessToken}>Save Fyers</Button>
              <Button variant="secondary" onClick={bootstrapEnvFyers} disabled={busy}>Import Fyers from .env</Button>
            </div>
          </div>

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

      {/* Execution controls — mode is TopBar-owned; account selection + kill/approve here */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-white">Live Gate &amp; Kill Switch</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={context?.context.executionMode === 'LIVE' ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/20 text-emerald-300'}>
            Desk mode: {context?.context.executionMode || status?.executionMode || '—'} (synced from TopBar)
          </Badge>
          <Button variant="destructive" onClick={() => toggleKillSwitch(true)}>Kill Switch ON</Button>
          <Button variant="outline" onClick={() => toggleKillSwitch(false)}>Kill Switch OFF</Button>
          <Button variant="outline" onClick={() => approveLive(true)}>Approve Live (Admin)</Button>
          <Button variant="ghost" onClick={() => approveLive(false)}>Revoke Live</Button>
        </div>
        <p className="text-xs text-gray-400">
          PAPER/LIVE is switched only from the TopBar (PIN + cooldown). This panel selects the active broker/MCP account.
          Live also requires: LIVE_TRADING_ENABLED=true, global approval, no kill switch, and healthy account.
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
