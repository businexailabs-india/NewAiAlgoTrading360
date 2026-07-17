import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { integrationService, BrokerAccountView, ExecutionContextView } from '../services/integrationService';

interface AccountManagementModalProps {
  onClose: () => void;
}

export function AccountManagementModal({ onClose }: AccountManagementModalProps) {
  const [accounts, setAccounts] = useState<BrokerAccountView[]>([]);
  const [context, setContext] = useState<ExecutionContextView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ displayName: 'Dhan', clientId: '', accessToken: '' });

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [accs, ctx] = await Promise.all([
        integrationService.listAccounts(),
        integrationService.getExecutionContext()
      ]);
      setAccounts(accs);
      setContext(ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    try {
      await integrationService.upsertDhanAccount({
        displayName: form.displayName,
        clientId: form.clientId,
        accessToken: form.accessToken,
        providerType: 'DIRECT'
      });
      setForm({ displayName: 'Dhan', clientId: '', accessToken: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const select = async (id: string) => {
    if (!context) return;
    setBusy(true);
    try {
      await integrationService.updateExecutionContext({
        activeBrokerConnectionId: id,
        expectedVersion: context.context.version
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Select failed');
    } finally {
      setBusy(false);
    }
  };

  const sync = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await integrationService.syncAccountPortfolio(id);
      setError('');
      await load();
      alert(`Synced ${result.holdingsCount} holdings (₹${Math.round(result.totalCurrent).toLocaleString('en-IN')})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  const bootstrapEnv = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await integrationService.bootstrapEnvDhan();
      await load();
      alert(`Connected from env · ${result.sync.holdingsCount} holdings synced`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-management-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-gray-900 border-b border-gray-800 z-10 flex items-center justify-between">
          <h2 id="account-management-title" className="text-xl text-white">Broker Accounts</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-sm text-gray-400">
          Mode: <Badge variant="outline">{context?.context.executionMode || 'PAPER'}</Badge>
          {' '}· Portfolio UI reads local DB — click Sync Portfolio to pull Dhan holdings.
        </p>

        {error && <div className="text-sm text-red-300 break-words">{error}</div>}

        <div className="space-y-2">
          <Input placeholder="Display name" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
          <Input placeholder="Dhan Client ID" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} />
          <Input placeholder="Access Token" type="password" value={form.accessToken} onChange={e => setForm({ ...form, accessToken: e.target.value })} />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={save} disabled={busy || !form.clientId || !form.accessToken}>Add / Update Dhan</Button>
            <Button variant="secondary" onClick={bootstrapEnv} disabled={busy}>Import from .env & Sync</Button>
            <Button variant="outline" onClick={load} disabled={busy} aria-label="Refresh accounts">
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {accounts.length === 0 && (
            <p className="text-gray-400 text-sm">No accounts yet — add Dhan credentials or import from backend .env</p>
          )}
          {accounts.map(a => (
            <div
              key={a.id}
              className="p-3 rounded-lg border border-gray-800 bg-gray-800/40 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm flex items-center gap-2">
                  {context?.context.activeBrokerConnectionId === a.id && (
                    <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span className="truncate">{a.displayName || a.broker}</span>
                </div>
                <div className="text-xs text-gray-400 break-all">
                  {a.status} · {a.providerType} · {a.maskedClientId}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => select(a.id)} disabled={busy}>
                  Select
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await integrationService.validateAccount(a.id);
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Validate failed');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Validate
                </Button>
                <Button size="sm" onClick={() => sync(a.id)} disabled={busy}>
                  Sync Portfolio
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
