import { useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle, FlaskConical, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';
import { advisoryMarketplaceService } from '../services/advisoryMarketplaceService';
import { useWindowStack } from '../contexts/WindowStackContext';

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(34,211,238,0.22)',
  background: 'rgba(15,23,42,0.7)',
  padding: 16,
};

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.35)',
  background: 'rgba(34,211,238,0.1)',
  color: '#67e8f9',
  cursor: 'pointer',
  fontSize: 12,
};

const solidBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#059669',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

export function AdvisoryMarketplacePanel() {
  const { restoreWindow } = useWindowStack();
  const [option, setOption] = useState<Record<string, unknown> | null>(null);
  const [paperResult, setPaperResult] = useState<Record<string, unknown> | null>(null);
  const [liveReq, setLiveReq] = useState<Record<string, unknown> | null>(null);
  const [external, setExternal] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [disclosure, setDisclosure] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);

  const runPaper = async () => {
    if (!option?.id) return;
    setBusy(true);
    try {
      const data = await advisoryMarketplaceService.paperTest(String(option.id)) as Record<string, unknown>;
      setPaperResult(data);
      setMsg(`Paper test ${data.result_status}. Qualified for live: ${data.qualified_for_live ? 'no auto — still needs approval' : 'no'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paper test failed');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!option?.id) return;
    setBusy(true);
    try {
      setOption(await advisoryMarketplaceService.save(String(option.id)) as Record<string, unknown>);
      setMsg('Strategy saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deployPaper = async () => {
    if (!option?.id) return;
    setBusy(true);
    try {
      setOption(await advisoryMarketplaceService.deployPaper(String(option.id)) as Record<string, unknown>);
      setMsg('Deployed to paper trading bot');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paper deploy failed');
    } finally {
      setBusy(false);
    }
  };

  const requestLive = async () => {
    if (!option?.id) return;
    setBusy(true);
    try {
      const data = await advisoryMarketplaceService.requestLive(String(option.id), {
        risk_disclosure_accepted: disclosure,
        explicit_confirmation: confirmLive,
        paper_qualified: Boolean(paperResult?.qualified_for_live)
      }) as Record<string, unknown>;
      setLiveReq(data);
      setMsg(data.status === 'blocked' ? 'Live request blocked by RMS/compliance' : 'Live approval pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Live request failed');
    } finally {
      setBusy(false);
    }
  };

  const loadExternal = async () => {
    setBusy(true);
    try {
      await advisoryMarketplaceService.discoverExternal();
      setExternal((await advisoryMarketplaceService.listExternal()) as Array<Record<string, unknown>>);
      setMsg('External candidates loaded (licensed/public/internal only)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          ...panel,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>
            <Sparkles className="h-4 w-4 text-cyan-300" />
            AI Algo Trade Advisory
          </div>
          <p style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
            Same desk as Trading / Investing Algos · paper first · live after approval
          </p>
        </div>
        <button type="button" style={solidBtn} onClick={() => restoreWindow('ai-algo-advisory')}>
          Open AI Advisory
        </button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#fecaca',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(248,113,113,0.35)',
            background: 'rgba(127,29,29,0.25)',
          }}
        >
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      {msg && (
        <div style={{ fontSize: 12, color: '#67e8f9', padding: '6px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.1)' }}>
          {msg}
        </div>
      )}

      {option && (
        <section style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>Convert to Algo</h3>
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
            {String(option.strategy_name)} · v{String(option.version)} ·{' '}
            <Badge className="border border-emerald-500/40 bg-emerald-500/15 font-medium text-emerald-300">
              {String(option.strategy_type)}
            </Badge>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            Paper test required. Live trading disabled by default. No one-click live.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={runPaper} disabled={busy} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}>
              <FlaskConical className="h-4 w-4" /> Run Paper Test
            </button>
            <button type="button" onClick={save} disabled={busy} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}>
              <Save className="h-4 w-4" /> Save
            </button>
            <button type="button" onClick={deployPaper} disabled={busy} style={{ ...solidBtn, opacity: busy ? 0.5 : 1 }}>
              Deploy Paper Bot
            </button>
          </div>
        </section>
      )}

      {paperResult && (
        <section style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>Paper Test Result</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.4)' }}>P&L: {String(paperResult.pnl)}</div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.4)' }}>Max DD: {String(paperResult.max_drawdown)}%</div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.4)' }}>Win rate: {String(paperResult.win_rate)}%</div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.4)' }}>Trades: {String(paperResult.trade_count)}</div>
          </div>
          <Badge className="w-fit border border-emerald-500/40 bg-emerald-500/15 font-medium text-emerald-300">
            {String(paperResult.result_status)}
          </Badge>
        </section>
      )}

      {option && (
        <section
          style={{
            ...panel,
            border: '1px solid rgba(248,113,113,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#fecaca' }}>
            <ShieldAlert className="h-4 w-4 text-rose-300" /> Live Deployment Confirmation
          </h3>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
            <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />
            I accept risk disclosures. This is not a guaranteed return. Losses are possible.
          </label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
            <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />
            I explicitly request live deployment after paper qualification and RMS checks.
          </label>
          <button
            type="button"
            disabled={busy || !disclosure || !confirmLive}
            onClick={requestLive}
            style={{
              ...solidBtn,
              background: '#be123c',
              opacity: busy || !disclosure || !confirmLive ? 0.4 : 1,
              width: 'fit-content',
            }}
          >
            Request Live Approval
          </button>
          {liveReq && (
            <div style={{ fontSize: 13, color: '#fde68a' }}>
              Status: {String(liveReq.status)}
              {Array.isArray(liveReq.block_reasons) && liveReq.block_reasons.length > 0 && (
                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                  {(liveReq.block_reasons as string[]).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {external.length > 0 && (
        <section style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>External Algo Candidates</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Third-party candidates are not verified for live until license + paper + approval.
          </p>
          {external.slice(0, 8).map((c) => (
            <div
              key={String(c.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(2,6,23,0.4)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{String(c.title)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {String(c.source_name)} · {String(c.license_status)} · {String(c.verification_status)}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                style={ghostBtn}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await advisoryMarketplaceService.normalizeExternal(String(c.id));
                    await advisoryMarketplaceService.riskScanExternal(String(c.id));
                    setExternal((await advisoryMarketplaceService.listExternal()) as Array<Record<string, unknown>>);
                    setMsg('Normalized + risk scanned');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Scan failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Normalize & Scan
              </button>
            </div>
          ))}
        </section>
      )}

      {!external.length && (
        <button type="button" onClick={loadExternal} disabled={busy} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1, width: 'fit-content' }}>
          <CheckCircle className="h-4 w-4" /> Discover External Algos
        </button>
      )}
    </div>
  );
}
