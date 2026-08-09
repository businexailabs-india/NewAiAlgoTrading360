import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { governanceApi } from '@/api/governance';

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(52,211,153,0.35)',
  background: 'rgba(15,23,42,0.92)',
  padding: 16,
  color: '#e2e8f0'
};

const btn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(52,211,153,0.4)',
  background: 'rgba(16,185,129,0.15)',
  color: '#6ee7b7',
  cursor: 'pointer',
  fontSize: 12
};

const input: CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#e2e8f0',
  width: '100%'
};

type Tab = 'dashboard' | 'recommend' | 'intent' | 'preapproval' | 'blocked';

/**
 * ExecutionGovernance360 Control Room
 * AI / TradingView / DhanLaxmi never execute — only OMS after RMS.
 */
export function ExecutionControlRoomPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [reco, setReco] = useState<Record<string, unknown> | null>(null);
  const [intentId, setIntentId] = useState('');
  const [timeline, setTimeline] = useState<Record<string, unknown>[]>([]);
  const [decision, setDecision] = useState<Record<string, unknown> | null>(null);
  const [blocked, setBlocked] = useState<Record<string, unknown>[]>([]);
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [symbol, setSymbol] = useState('RELIANCE');
  const [source, setSource] = useState('USER_MANUAL');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ruleSymbol, setRuleSymbol] = useState('RELIANCE');

  const reload = async () => {
    setStatus(await governanceApi.controlStatus());
    setRules(await governanceApi.listPreapprovals());
    setBlocked(await governanceApi.blockedActions());
  };

  useEffect(() => {
    void reload().catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  const runRecommend = async () => {
    setBusy(true);
    try {
      setReco(await governanceApi.recommend());
      setTab('recommend');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Recommend failed');
    } finally {
      setBusy(false);
    }
  };

  const createAndEvaluate = async () => {
    setBusy(true);
    setMsg('');
    try {
      const intent = await governanceApi.createIntent({
        source,
        mode: 'PAPER',
        symbol,
        side: 'BUY',
        quantity: 1,
        price: 1400,
        stop_loss: 1350,
        instrument_type: 'STOCK'
      });
      const id = String(intent.id);
      setIntentId(id);
      const ev = await governanceApi.evaluate(id);
      setDecision(ev);
      setTimeline(await governanceApi.timeline(id));
      setMsg(`Intent ${id.slice(0, 8)}… · decision=${String(ev.decision)} · can_execute_directly=false`);
      setTab('intent');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Intent failed');
    } finally {
      setBusy(false);
    }
  };

  const pipeline = async (step: 'approve' | 'rms' | 'oms') => {
    if (!intentId) return;
    setBusy(true);
    try {
      if (step === 'approve') await governanceApi.approve(intentId);
      if (step === 'rms') await governanceApi.submitRms(intentId);
      if (step === 'oms') {
        const res = await governanceApi.submitOms(intentId);
        toast.success(`OMS paper executed ${(res.order as { id?: string })?.id || ''}`);
      }
      setTimeline(await governanceApi.timeline(intentId));
      setDecision(await governanceApi.evaluate(intentId).catch(() => decision));
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Step failed');
      try {
        const ex = await governanceApi.explainBlock(intentId);
        setMsg(String(ex.reason || e));
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const createRule = async () => {
    setBusy(true);
    try {
      await governanceApi.createPreapproval({
        mode: 'PAPER',
        allowed_symbols: [ruleSymbol],
        max_quantity_per_order: 5,
        max_risk_per_trade: 300,
        max_daily_loss: 1000,
        max_trades_per_day: 5,
        requires_stop_loss: true,
        allowed_time_window_start: '09:15',
        allowed_time_window_end: '15:20'
      });
      toast.success('Preapproval rule created (paper)');
      await reload();
      setTab('preapproval');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rule failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6ee7b7' }}>ExecutionGovernance360</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            AI / TradingView / DhanLaxmi recommend only — OMS executes after RMS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['dashboard', 'recommend', 'intent', 'preapproval', 'blocked'] as Tab[]).map((t) => (
            <button key={t} type="button" style={{ ...btn, opacity: tab === t ? 1 : 0.65 }} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, color: '#fde68a', fontSize: 13 }}>{msg}</div> : null}

      {tab === 'dashboard' && status && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
            <Stat label="Mode" value={String(status.mode)} />
            <Stat label="Live" value={status.live_locked ? 'LOCKED' : 'OPEN'} />
            <Stat label="Kill switch" value={status.kill_switch ? 'ON' : 'OFF'} />
            <Stat label="Approvals" value={String(status.active_approvals)} />
            <Stat label="Preapproval rules" value={String(status.active_preapproval_rules)} />
            <Stat label="Blocked today" value={String(status.blocked_actions_today)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn} disabled={busy} onClick={() => void runRecommend()}>
              Recommend algos
            </button>
            <button
              type="button"
              style={{ ...btn, background: 'rgba(248,113,113,0.2)', color: '#fca5a5' }}
              onClick={() => void governanceApi.killSwitch(true).then(reload)}
            >
              Kill switch ON
            </button>
            <button type="button" style={btn} onClick={() => void governanceApi.killSwitch(false).then(reload)}>
              Kill switch OFF
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            ₹1L defaults: target 300–700 · max loss 1000 · max risk/trade 300 · 5 trades/day · paper on · live
            off
          </div>
        </div>
      )}

      {tab === 'recommend' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <button type="button" style={btn} disabled={busy} onClick={() => void runRecommend()}>
            Refresh recommendations
          </button>
          {reco ? (
            <div style={{ padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 700 }}>
                {String(reco.algo)} · score {String(reco.score)}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{String(reco.reason)}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Mode: {String(reco.allowed_mode)} · approval required · paper-test required · never auto-executes
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Blocked: {((reco.blocked as { algo_id?: string }[]) || []).map((b) => b.algo_id).join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>No recommendation yet</div>
          )}
        </div>
      )}

      {tab === 'intent' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <select style={input} value={source} onChange={(e) => setSource(e.target.value)}>
              {[
                'USER_MANUAL',
                'AI_ADVISORY',
                'TRADINGVIEW_ALERT',
                'DHANLAXMI_PROMPT',
                'CHART_ACTION',
                'BASKET_ORDER',
                'STRATEGY_ENGINE'
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input style={input} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            <button type="button" style={btn} disabled={busy} onClick={() => void createAndEvaluate()}>
              Create &amp; evaluate
            </button>
          </div>
          {intentId ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={() => void pipeline('approve')}>
                Approve
              </button>
              <button type="button" style={btn} onClick={() => void pipeline('rms')}>
                Submit RMS
              </button>
              <button type="button" style={btn} onClick={() => void pipeline('oms')}>
                Submit OMS (paper)
              </button>
            </div>
          ) : null}
          {decision ? (
            <pre style={{ fontSize: 11, background: '#020617', padding: 10, borderRadius: 8, overflow: 'auto' }}>
              {JSON.stringify(
                {
                  decision: decision.decision,
                  can_execute_directly: decision.can_execute_directly,
                  next_action: decision.next_action,
                  source: decision.source
                },
                null,
                2
              )}
            </pre>
          ) : null}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Timeline</div>
            {timeline.map((t) => (
              <div key={String(t.id)} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid #1e293b' }}>
                <b>{String(t.status)}</b> — {String(t.detail)}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'preapproval' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} value={ruleSymbol} onChange={(e) => setRuleSymbol(e.target.value)} />
            <button type="button" style={btn} onClick={() => void createRule()}>
              Create paper preapproval
            </button>
          </div>
          {rules.map((r) => (
            <div key={String(r.id)} style={{ padding: 10, borderRadius: 8, border: '1px solid #334155', fontSize: 12 }}>
              {String(r.mode)} · qty≤{String(r.maxQuantityPerOrder)} ·{' '}
              {JSON.stringify(r.allowedSymbols)} · {r.enabled ? 'enabled' : 'disabled'}
            </div>
          ))}
        </div>
      )}

      {tab === 'blocked' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {blocked.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No blocked attempts yet</div>
          ) : (
            blocked.map((b) => (
              <div key={String(b.id)} style={{ padding: 8, borderRadius: 8, border: '1px solid #7f1d1d', fontSize: 12 }}>
                <b>{String(b.source)}</b> — {String(b.reason)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'rgba(2,6,23,0.8)', border: '1px solid #334155' }}>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
