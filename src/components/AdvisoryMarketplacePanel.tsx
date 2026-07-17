import { useState } from 'react';
import { AlertTriangle, CheckCircle, FlaskConical, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { advisoryMarketplaceService } from '../services/advisoryMarketplaceService';
import { useWindowStack } from '../contexts/WindowStackContext';

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            AI Algo Trade Advisory
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Opens from the top menu · convert candidates here after paper test
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-cyan-300/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
          onClick={() => restoreWindow('ai-algo-advisory')}
        >
          Open AI Advisory
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-300 flex gap-2 items-center">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {msg && <div className="text-sm text-emerald-300">{msg}</div>}

      {option && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-white">Convert to Algo</h3>
          <div className="text-sm text-gray-300">
            {String(option.strategy_name)} · v{String(option.version)} ·{' '}
            <Badge variant="outline">{String(option.strategy_type)}</Badge>
          </div>
          <p className="text-xs text-gray-500">
            Paper test required. Live trading disabled by default. No one-click live.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runPaper} disabled={busy}>
              <FlaskConical className="w-4 h-4 mr-1" /> Run Paper Test
            </Button>
            <Button variant="outline" onClick={save} disabled={busy}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button variant="secondary" onClick={deployPaper} disabled={busy}>
              Deploy Paper Bot
            </Button>
          </div>
        </section>
      )}

      {paperResult && (
        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
          <h3 className="text-white">Paper Test Result</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300">
            <div>P&L: {String(paperResult.pnl)}</div>
            <div>Max DD: {String(paperResult.max_drawdown)}%</div>
            <div>Win rate: {String(paperResult.win_rate)}%</div>
            <div>Trades: {String(paperResult.trade_count)}</div>
          </div>
          <Badge variant="outline">{String(paperResult.result_status)}</Badge>
        </section>
      )}

      {option && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <h3 className="text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> Live Deployment Confirmation
          </h3>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />
            I accept risk disclosures. This is not a guaranteed return. Losses are possible.
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />
            I explicitly request live deployment after paper qualification and RMS checks.
          </label>
          <Button variant="destructive" disabled={busy || !disclosure || !confirmLive} onClick={requestLive}>
            Request Live Approval
          </Button>
          {liveReq && (
            <div className="text-sm text-amber-100">
              Status: {String(liveReq.status)}
              {Array.isArray(liveReq.block_reasons) && liveReq.block_reasons.length > 0 && (
                <ul className="list-disc ml-5 mt-1 text-amber-200/80">
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
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-white">External Algo Candidates</h3>
          <p className="text-xs text-gray-500">
            Third-party candidates are not verified for live until license + paper + approval.
          </p>
          {external.slice(0, 8).map((c) => (
            <div key={String(c.id)} className="p-3 rounded-lg bg-black/30 border border-white/5 flex justify-between gap-2">
              <div>
                <div className="text-white text-sm">{String(c.title)}</div>
                <div className="text-xs text-gray-400">
                  {String(c.source_name)} · {String(c.license_status)} · {String(c.verification_status)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
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
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!external.length && (
        <Button variant="outline" onClick={loadExternal} disabled={busy}>
          <CheckCircle className="w-4 h-4 mr-1" /> Discover External Algos
        </Button>
      )}
    </div>
  );
}
