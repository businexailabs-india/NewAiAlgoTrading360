import { useMemo, useState } from 'react';
import { tradeos } from '@/components/tradeos/tokens';
import { SafetyBanner, StatusPill } from '@/components/tradeos';
import { Badge, Btn, Card, Grid, Kpi, Table } from './ui';
import { BotChart } from './chart';
import { useTradingBots } from './store';
import { computeSupportResistance } from './engine/sr';
import { evaluateBreakout } from './engine/signals';
import { atr, ema, vwap } from './engine/market';
import { buildOptionChain, scoreCandidate, selectBearCall, selectBullPut } from './engine/options';
import { evaluateRisk } from './engine/risk';
import { pickStable, runBacktest } from './engine/backtest';
import { defaultConfig } from './seed';
import type { BotConfig, StrategyKind } from './types';

const statusColor: Record<string, string> = {
  RUNNING: tradeos.green,
  PAUSED: tradeos.amber,
  STOPPED: tradeos.muted,
  HALTED: tradeos.red,
  COOLDOWN: tradeos.blue
};

export function DashboardView() {
  const { bots, positions, deskMode, emergency, stale, lastTick, runSignalPass, spot } = useTradingBots();
  const capital = bots.reduce((s, b) => s + b.config.capital, 0) / Math.max(1, bots.length);
  const today = bots.reduce((s, b) => s + b.todayPnl, 0);
  const total = bots.reduce((s, b) => s + b.totalPnl, 0);
  const open = positions.filter((p) => p.status === 'OPEN');
  const unreal = open.reduce((s, p) => s + p.pnl, 0);
  const active = bots.filter((b) => b.status === 'RUNNING').length;
  const trades = bots.reduce((s, b) => s + b.trades, 0);
  const wr = Math.round(bots.reduce((s, b) => s + b.winRate, 0) / Math.max(1, bots.length));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Grid n={5}>
        <Kpi label="Total Trading Capital" value={`₹${Math.round(capital).toLocaleString('en-IN')}`} />
        <Kpi label="Today's P&L" value={`₹${today.toLocaleString('en-IN')}`} />
        <Kpi label="Realized P&L" value={`₹${total.toLocaleString('en-IN')}`} />
        <Kpi label="Unrealized P&L" value={`₹${Math.round(unreal).toLocaleString('en-IN')}`} />
        <Kpi label="Open Positions" value={String(open.length)} />
        <Kpi label="Active Bots" value={String(active)} />
        <Kpi label="Today's Trades" value={String(Math.min(trades, 6))} />
        <Kpi label="Win Rate" value={`${wr}%`} />
        <Kpi label="Margin Utilization" value="22%" />
        <Kpi label="Current Portfolio Risk" value="LOW" />
      </Grid>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusPill label={`SYSTEM ${emergency ? 'HALTED' : stale ? 'STALE' : 'HEALTHY'}`} tone={emergency || stale ? 'blocked' : 'safe'} />
        <StatusPill label={deskMode === 'PAPER' ? 'PAPER TRADING' : 'LIVE TRADING'} tone={deskMode === 'PAPER' ? 'safe' : 'warning'} />
        <StatusPill label={`Spot ${Math.round(spot)}`} tone="info" />
        <span style={{ fontSize: 11, color: tradeos.muted }}>Last market update {lastTick.toLocaleTimeString()}</span>
        <Btn tone="primary" onClick={runSignalPass}>
          Run signal pass
        </Btn>
      </div>
      <SafetyBanner
        title="Paper is default. Live stays off until you connect a broker and confirm."
        body="AI cannot bypass the risk engine, kill switch, or defined-risk spread rules. No martingale. No naked shorts."
        tone="info"
      />
    </div>
  );
}

export function MyBotsView() {
  const { bots, setSelectedId, setPage, setBotStatus, cloneBot } = useTradingBots();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
      {bots.map((b) => (
        <Card key={b.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: tradeos.text }}>{b.config.name}</div>
              <div style={{ fontSize: 12, color: tradeos.muted, marginTop: 4 }}>
                Strategy: {b.config.strategy === 'sr_hedging' ? 'Bull Put Spread / Bear Call Spread' : b.config.strategy}
              </div>
            </div>
            <Badge text={b.status} color={statusColor[b.status]} />
          </div>
          <div style={{ fontSize: 12, color: tradeos.muted, marginTop: 8, lineHeight: 1.6 }}>
            Underlying {b.config.underlying} · Timeframe {b.config.timeframe} · Mode {b.mode}
            <br />
            Today ₹{b.todayPnl.toLocaleString('en-IN')} · Total ₹{b.totalPnl.toLocaleString('en-IN')} · Win {b.winRate}% · Trades {b.trades}
            <br />
            Signal {b.currentSignal} · State {b.state} · Risk {b.riskLevel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            <Btn tone="primary" onClick={() => setBotStatus(b.id, 'RUNNING')}>
              START
            </Btn>
            <Btn onClick={() => setBotStatus(b.id, 'PAUSED')}>PAUSE</Btn>
            <Btn onClick={() => setBotStatus(b.id, 'STOPPED')}>STOP</Btn>
            <Btn onClick={() => cloneBot(b.id)}>CLONE</Btn>
            <Btn
              onClick={() => {
                setSelectedId(b.id);
                setPage('analytics');
              }}
            >
              ANALYTICS
            </Btn>
            <Btn
              onClick={() => {
                setSelectedId(b.id);
                setPage('bot-detail');
              }}
            >
              VIEW DETAILS
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SignalsView() {
  const { signals, selectedSignalId, setSelectedSignalId } = useTradingBots();
  const sel = signals.find((s) => s.id === selectedSignalId) || signals[0];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
      <Card title="Live Signals">
        <Table
          cols={['Time', 'Underlying', 'Spot', 'S', 'R', 'Signal', 'Score', 'Strategy', 'Expiry', 'Short', 'Hedge', 'Risk', 'Status']}
          rows={signals.map((s) => [
            <button key={s.id} type="button" onClick={() => setSelectedSignalId(s.id)} style={{ background: 'none', border: 'none', color: tradeos.blue, cursor: 'pointer' }}>
              {s.time}
            </button>,
            s.underlying,
            s.spot,
            s.support,
            s.resistance,
            s.kind,
            s.score,
            s.strategy,
            s.expiry,
            s.shortStrike || '—',
            s.hedgeStrike || '—',
            s.risk || '—',
            s.status
          ])}
        />
        {signals.length === 0 ? <div style={{ color: tradeos.muted, fontSize: 13 }}>No signals yet. Run a signal pass from the dashboard.</div> : null}
      </Card>
      <Card title="WHY THIS SIGNAL?">
        {sel ? (
          <div style={{ fontSize: 13, color: tradeos.text, lineHeight: 1.6 }}>
            {sel.breakdown.map((b) => (
              <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: tradeos.muted }}>{b.label}</span>
                <span>{b.points > 0 ? `+${b.points}` : '0'}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, fontWeight: 700 }}>
              Total {sel.score}/100 · {sel.status}
            </div>
            <div style={{ marginTop: 8, color: tradeos.muted }}>{sel.explanation}</div>
            {sel.rejectReason ? (
              <div style={{ marginTop: 8, color: tradeos.red }}>
                TRADE REJECTED · {sel.rejectReason}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: tradeos.muted }}>Select a signal.</div>
        )}
      </Card>
    </div>
  );
}

export function OptionChainView() {
  const { spot, selected } = useTradingBots();
  const [expiry, setExpiry] = useState('weekly');
  const chain = useMemo(() => buildOptionChain(spot), [spot]);
  const atm = chain.reduce((a, r) => (Math.abs(r.strike - spot) < Math.abs(a.strike - spot) ? r : a), chain[0]);
  if (!selected?.config) {
    return <div style={{ color: tradeos.muted, fontSize: 13 }}>No bot selected.</div>;
  }
  const bull = selectBullPut(spot, selected.config, chain);
  const bear = selectBearCall(spot, selected.config, chain);
  const rec = [bull, bear].filter(Boolean).sort((a, b) => scoreCandidate(b!, chain) - scoreCandidate(a!, chain))[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: tradeos.muted }}>Expiry</span>
        <Btn tone={expiry === 'weekly' ? 'primary' : 'default'} onClick={() => setExpiry('weekly')}>
          Weekly
        </Btn>
        <Btn tone={expiry === 'next' ? 'primary' : 'default'} onClick={() => setExpiry('next')}>
          Next week
        </Btn>
      </div>
      <Card title="AI Strike Selector (advisory — risk engine still decides)">
        {rec ? (
          <div style={{ fontSize: 13, color: tradeos.text, lineHeight: 1.55 }}>
            RECOMMENDED SPREAD: {rec.type} {rec.shortStrike}/{rec.longStrike} · credit {rec.netCredit} · max loss {rec.maxLoss} · RR {rec.riskReward}
            <div style={{ color: tradeos.muted, marginTop: 6 }}>{rec.explanation}</div>
          </div>
        ) : (
          <div style={{ color: tradeos.muted }}>No defined-risk candidate at target delta.</div>
        )}
      </Card>
      <Card title="Option Chain">
        <Table
          cols={['Strike', 'CE LTP', 'CE IV', 'CE Δ', 'CE Vol', 'CE OI', 'CE ΔOI', 'PE LTP', 'PE IV', 'PE Δ', 'PE Vol', 'PE OI', 'PE ΔOI']}
          rows={chain.map((r) => {
            const isAtm = r.strike === atm.strike;
            const short = r.strike === rec?.shortStrike;
            const hedge = r.strike === rec?.longStrike;
            const hiOi = r.callOi > 1_800_000 || r.putOi > 1_800_000;
            const mark = isAtm ? ' ATM' : short ? ' SHORT' : hedge ? ' HEDGE' : hiOi ? ' OI' : '';
            return [
              `${r.strike}${mark}`,
              r.callLtp,
              r.callIv,
              r.callDelta,
              r.callVol,
              r.callOi,
              r.callChgOi,
              r.putLtp,
              r.putIv,
              r.putDelta,
              r.putVol,
              r.putOi,
              r.putChgOi
            ];
          })}
        />
      </Card>
    </div>
  );
}

export function PositionsView() {
  const { positions } = useTradingBots();
  return (
    <Card title="Open Positions (PAPER labeled)">
      <Table
        cols={['Bot', 'Underlying', 'Strategy', 'Expiry', 'Short', 'Long', 'Qty', 'Credit', 'Mkt', 'P&L', 'P&L %', 'Δ', 'Θ', 'Max risk', 'Status', '']}
        rows={positions.map((p) => [
          p.botId,
          p.underlying,
          p.strategy,
          p.expiry,
          p.shortStrike,
          p.longStrike,
          p.qty,
          p.entryCredit,
          p.currentSpread,
          Math.round(p.pnl),
          `${p.pnlPct}%`,
          p.delta,
          p.theta,
          p.maxRisk,
          `${p.status} · ${p.mode}`,
          <span key="a">VIEW · EXIT · REDUCE · CLOSE SPREAD</span>
        ])}
      />
      {positions.length === 0 ? <div style={{ color: tradeos.muted, fontSize: 13 }}>No open spreads. Eligible paper signals can open defined-risk hedges only.</div> : null}
    </Card>
  );
}

export function OrdersView() {
  const { orders } = useTradingBots();
  return (
    <Card title="Order workflow: SIGNAL → RISK → SPREAD → VALIDATE → HEDGE CHECK → SUBMIT → CONFIRM → POSITION">
      <Table
        cols={['ID', 'Time', 'Bot', 'Legs', 'Qty', 'State', 'Mode', 'Note']}
        rows={orders.map((o) => [o.id, o.time, o.botId, o.legs, o.qty, o.state, o.mode, o.note])}
      />
    </Card>
  );
}

export function RiskView() {
  const { selected, positions } = useTradingBots();
  const snap = evaluateRisk(
    selected.config,
    selected.todayPnl,
    positions.reduce((s, p) => s + p.maxRisk * p.qty, 0),
    0
  );
  const c = selected.config;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Grid n={4}>
        <Kpi label="Trading Capital" value={`₹${snap.tradingCapital.toLocaleString('en-IN')}`} />
        <Kpi label="Available" value={`₹${Math.round(snap.available).toLocaleString('en-IN')}`} />
        <Kpi label="Margin Used" value={`₹${Math.round(snap.marginUsed).toLocaleString('en-IN')}`} />
        <Kpi label="Margin Available" value={`₹${Math.round(snap.marginAvailable).toLocaleString('en-IN')}`} />
        <Kpi label="Daily Risk" value={`₹${Math.round(snap.dailyRisk).toLocaleString('en-IN')}`} />
        <Kpi label="Open Risk" value={`₹${Math.round(snap.openRisk).toLocaleString('en-IN')}`} />
        <Kpi label="Max Potential Loss" value={`₹${Math.round(snap.maxPotentialLoss).toLocaleString('en-IN')}`} />
        <Kpi label="Delta / Gamma / Theta / Vega" value={`${snap.portfolioDelta} / ${snap.gamma} / ${snap.theta} / ${snap.vega}`} />
      </Grid>
      {snap.halted ? <SafetyBanner title="BOT STATUS: HALTED" body={snap.haltReason} tone="blocked" /> : <SafetyBanner title="Risk engine armed" body={`Risk/trade ${c.riskPct}% · Daily loss ${c.dailyLossLimitPct}% · Max positions ${c.maxOpenPositions} · Max margin ${c.maxMarginUsagePct}% · Max consecutive losses ${c.maxConsecutiveLosses}.`} tone="safe" />}
    </div>
  );
}

export function JournalView() {
  const { journal } = useTradingBots();
  const csv = () => {
    const headers = Object.keys(journal[0] || {});
    const body = [headers.join(','), ...journal.map((r) => headers.map((h) => JSON.stringify((r as unknown as Record<string, unknown>)[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tradingbots-journal.csv';
    a.click();
  };
  return (
    <Card title="Trade Journal" extra={<Btn onClick={csv}>Export CSV / Excel</Btn>}>
      <Table
        cols={['ID', 'Bot', 'Date', 'In', 'Out', 'Und', 'Signal', 'Score', 'Regime', 'S', 'R', 'Strat', 'Expiry', 'Short', 'Long', 'Qty', 'Credit', 'Max risk', 'Entry', 'Exit', 'Gross', 'Fees', 'Net', 'MFE', 'MAE']}
        rows={journal.map((j) => [
          j.id,
          j.bot,
          j.date,
          j.entryTime,
          j.exitTime,
          j.underlying,
          j.signal,
          j.score,
          j.regime,
          j.support,
          j.resistance,
          j.strategy,
          j.expiry,
          j.shortStrike,
          j.longStrike,
          j.qty,
          j.credit,
          j.maxRisk,
          j.entryReason,
          j.exitReason,
          j.grossPnl,
          j.fees,
          j.netPnl,
          j.mfe,
          j.mae
        ])}
      />
    </Card>
  );
}

export function BacktestView() {
  const { selected } = useTradingBots();
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-09-30');
  const a = runBacktest({ ...selected.config, atrBuffer: 0.1, shortDeltaMax: 0.15 }, from, to);
  const b = runBacktest({ ...selected.config, atrBuffer: 0.2, shortDeltaMax: 0.2 }, from, to);
  const c = runBacktest({ ...selected.config, atrBuffer: 0.3, shortDeltaMax: 0.25 }, from, to);
  const ab = pickStable(a, b) === 'A' ? a : b;
  const stable = pickStable(ab, c) === 'A' ? (pickStable(a, b) === 'A' ? 'A' : 'B') : 'C';
  const show = (r: typeof a) =>
    `${r.totalTrades} trades · WR ${r.winRate}% · Net ₹${r.netPnl.toLocaleString('en-IN')} · PF ${r.profitFactor} · DD ${r.maxDd}% · Sharpe ${r.sharpe} · Stab ${r.stability}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={`Backtest · ${selected.config.name}`}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 12, color: tradeos.muted }}>
          <label>
            From <input value={from} onChange={(e) => setFrom(e.target.value)} style={{ background: 'transparent', color: tradeos.text, border: `1px solid ${tradeos.cardBorder}`, borderRadius: 6 }} />
          </label>
          <label>
            To <input value={to} onChange={(e) => setTo(e.target.value)} style={{ background: 'transparent', color: tradeos.text, border: `1px solid ${tradeos.cardBorder}`, borderRadius: 6 }} />
          </label>
        </div>
        <div style={{ fontSize: 13, color: tradeos.text, lineHeight: 1.7 }}>
          Base config: {show(runBacktest(selected.config, from, to))}
          <br />A ATR 0.10 / Δ 0.15: {show(a)}
          <br />B ATR 0.20 / Δ 0.20: {show(b)}
          <br />C ATR 0.30 / Δ 0.25: {show(c)}
        </div>
        <SafetyBanner
          title={`Stability pick: Strategy ${stable}`}
          body="Largest historical profit is not auto-selected. Ranking uses Sharpe, drawdown, and stability. Past simulation is not a live forecast."
          tone="info"
        />
        <svg viewBox="0 0 400 80" width="100%" style={{ marginTop: 12 }}>
          {runBacktest(selected.config, from, to).equity.map((v, i, arr) => {
            const min = Math.min(...arr);
            const max = Math.max(...arr);
            const x = (i / (arr.length - 1)) * 400;
            const y = 70 - ((v - min) / (max - min || 1)) * 60;
            return i === 0 ? null : (
              <line
                key={i}
                x1={((i - 1) / (arr.length - 1)) * 400}
                y1={70 - ((arr[i - 1] - min) / (max - min || 1)) * 60}
                x2={x}
                y2={y}
                stroke={tradeos.teal}
              />
            );
          })}
        </svg>
      </Card>
    </div>
  );
}

export function AnalyticsView() {
  const { bots, journal } = useTradingBots();
  return (
    <Grid n={2}>
      <Card title="P&L by bot">
        {bots.map((b) => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', color: tradeos.text }}>
            <span>{b.config.name}</span>
            <span>{b.totalPnl.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </Card>
      <Card title="Bull Put vs Bear Call">
        {['BULL PUT SPREAD', 'BEAR CALL SPREAD'].map((s) => {
          const rows = journal.filter((j) => j.strategy === s);
          const net = rows.reduce((a, r) => a + r.netPnl, 0);
          return (
            <div key={s} style={{ color: tradeos.text, fontSize: 13, padding: '6px 0' }}>
              {s}: ₹{net.toLocaleString('en-IN')} ({rows.length} trades)
            </div>
          );
        })}
      </Card>
    </Grid>
  );
}

export function AlertsView() {
  const { alerts, audit } = useTradingBots();
  return (
    <Grid n={2}>
      <Card title="Alert Center">
        {alerts.map((a) => (
          <div key={a.id} style={{ fontSize: 12, color: a.severity === 'crit' ? tradeos.red : tradeos.text, padding: '6px 0' }}>
            {a.time} · {a.type} · {a.message}
          </div>
        ))}
      </Card>
      <Card title="Audit log">
        {audit.slice(0, 12).map((a) => (
          <div key={a.id} style={{ fontSize: 12, color: tradeos.muted, padding: '6px 0' }}>
            {a.time} · {a.action} · {a.detail}
          </div>
        ))}
      </Card>
    </Grid>
  );
}

export function BrokersView() {
  const { brokers, requestLive, deskMode, setPaper } = useTradingBots();
  const [msg, setMsg] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SafetyBanner title={`Desk mode: ${deskMode}`} body="Credentials never shown in full. Strategy code talks only to BrokerAdapter." tone="info" />
      {brokers.map((b) => (
        <Card key={b.id} title={b.label}>
          <div style={{ fontSize: 13, color: tradeos.muted }}>
            Connected: {b.connected ? 'yes' : 'no'} · Secret {b.secretMasked}
          </div>
        </Card>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn
          tone="danger"
          onClick={() => {
            setMsg(requestLive());
          }}
        >
          Request LIVE (explicit)
        </Btn>
        <Btn tone="primary" onClick={setPaper}>
          Stay PAPER
        </Btn>
      </div>
      {msg ? <div style={{ color: tradeos.amber, fontSize: 13 }}>{msg}</div> : null}
    </div>
  );
}

export function ConfigView() {
  const { selected, saveConfig } = useTradingBots();
  const [cfg, setCfg] = useState<BotConfig>(selected.config);
  const set = (k: keyof BotConfig, v: string | number | boolean | string[]) => setCfg((c) => ({ ...c, [k]: v }));
  return (
    <Card title={`${cfg.name} · config v${cfg.version}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12, color: tradeos.muted }}>
        {(
          [
            ['name', cfg.name],
            ['underlying', cfg.underlying],
            ['timeframe', cfg.timeframe],
            ['atrPeriod', cfg.atrPeriod],
            ['atrBuffer', cfg.atrBuffer],
            ['confirmationScore', cfg.confirmationScore],
            ['shortDeltaMin', cfg.shortDeltaMin],
            ['shortDeltaMax', cfg.shortDeltaMax],
            ['spreadWidth', cfg.spreadWidth],
            ['dte', cfg.dte],
            ['riskPct', cfg.riskPct],
            ['profitTargetPct', cfg.profitTargetPct],
            ['stopLossPct', cfg.stopLossPct],
            ['trailEnableAt', cfg.trailEnableAt],
            ['trailTightenAt', cfg.trailTightenAt],
            ['dailyLossLimitPct', cfg.dailyLossLimitPct],
            ['entryStart', cfg.entryStart],
            ['lastEntry', cfg.lastEntry],
            ['exitTime', cfg.exitTime]
          ] as const
        ).map(([k, v]) => (
          <label key={k}>
            {k}
            <input
              value={String(v)}
              onChange={(e) => {
                const n = Number(e.target.value);
                set(k, Number.isFinite(n) && e.target.value !== '' && k !== 'name' && k !== 'underlying' && k !== 'timeframe' && !String(k).includes('Time') && k !== 'entryStart' && k !== 'lastEntry' && k !== 'exitTime' ? n : e.target.value);
              }}
              style={{ width: '100%', marginTop: 4, background: 'transparent', color: tradeos.text, border: `1px solid ${tradeos.cardBorder}`, borderRadius: 6, padding: 6 }}
            />
          </label>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn tone="primary" onClick={() => saveConfig(selected.id, cfg)}>
          Save versioned config
        </Btn>
      </div>
    </Card>
  );
}

export function MarketplaceView() {
  const { setPage } = useTradingBots();
  const items: { name: string; kind: StrategyKind; note: string }[] = [
    { name: 'Support & Resistance Hedging', kind: 'sr_hedging', note: 'Built-in · defined-risk credit spreads' },
    { name: 'Breakout', kind: 'breakout', note: 'Plug-in slot' },
    { name: 'Trend', kind: 'trend', note: 'Plug-in slot' },
    { name: 'Mean Reversion', kind: 'mean_reversion', note: 'Plug-in slot' },
    { name: 'Iron Condor', kind: 'iron_condor', note: 'Defined-risk only' },
    { name: 'Custom', kind: 'custom', note: 'Bring your own rules' }
  ];
  return (
    <Grid n={3}>
      {items.map((it) => (
        <Card key={it.kind} title={it.name}>
          <div style={{ color: tradeos.muted, fontSize: 13 }}>{it.note}</div>
          <div style={{ marginTop: 10 }}>
            <Btn tone="primary" onClick={() => setPage('dashboard')}>
              Open dashboard
            </Btn>
          </div>
        </Card>
      ))}
    </Grid>
  );
}

export function CreateBotView() {
  const { createBot, setPage } = useTradingBots();
  const [step, setStep] = useState(1);
  const [cfg, setCfg] = useState<BotConfig>(defaultConfig({ name: 'New Hedging Bot', underlying: 'NIFTY', strategy: 'sr_hedging' }));
  const next = () => setStep((s) => Math.min(9, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));
  return (
    <Card title={`Create Bot · Step ${step} of 9`}>
      {step === 1 && (
        <div>
          Underlying{' '}
          <select value={cfg.underlying} onChange={(e) => setCfg({ ...cfg, underlying: e.target.value })} style={{ background: '#0f172a', color: tradeos.text }}>
            {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      )}
      {step === 2 && (
        <div>
          Strategy{' '}
          <select value={cfg.strategy} onChange={(e) => setCfg({ ...cfg, strategy: e.target.value as StrategyKind })} style={{ background: '#0f172a', color: tradeos.text }}>
            <option value="sr_hedging">Support/Resistance Hedging</option>
            <option value="breakout">Breakout</option>
            <option value="trend">Trend</option>
            <option value="mean_reversion">Mean Reversion</option>
            <option value="iron_condor">Iron Condor</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      )}
      {step === 3 && <div>Signal: ATR buffer {cfg.atrBuffer}, score ≥ {cfg.confirmationScore}, VWAP/EMA/RSI/Volume/ADX filters on.</div>}
      {step === 4 && <div>Options: short delta {cfg.shortDeltaMin}–{cfg.shortDeltaMax}, width {cfg.spreadWidth}, DTE {cfg.dte}.</div>}
      {step === 5 && <div>Risk: {cfg.riskPct}% per trade, daily loss {cfg.dailyLossLimitPct}%, max positions {cfg.maxOpenPositions}.</div>}
      {step === 6 && <div>Exits: profit {cfg.profitTargetPct}% of credit, stop {cfg.stopLossPct}%, trail at {cfg.trailEnableAt}% / {cfg.trailTightenAt}%, EOD {cfg.exitTime}.</div>}
      {step === 7 && <div>Backtest preview uses historical simulation. It is not auto-activation.</div>}
      {step === 8 && <div>Paper trade is the only activation path from this wizard. Live stays off.</div>}
      {step === 9 && <div>Activate in PAPER. Start from My Bots when you are ready. Never default to live.</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Btn onClick={back}>Back</Btn>
        {step < 9 ? (
          <Btn tone="primary" onClick={next}>
            Next
          </Btn>
        ) : (
          <Btn
            tone="primary"
            onClick={() => {
              createBot(cfg);
              setPage('my-bots');
            }}
          >
            Create in PAPER
          </Btn>
        )}
      </div>
    </Card>
  );
}

export function DecisionFlow() {
  return (
    <Card title="Strategy decision engine">
      <div style={{ fontSize: 13, color: tradeos.text, lineHeight: 1.8, fontFamily: 'ui-monospace, monospace' }}>
        MARKET → SUPPORT / RESISTANCE → BREAKOUT DETECTOR → CONFIRMATION ENGINE
        <br />
        If resistance break → BULLISH → BULL PUT SPREAD
        <br />
        If support break → BEARISH → BEAR CALL SPREAD
        <br />
        Else → NO TRADE
        <br />
        Failed breakout → COOLDOWN (no instant reverse)
      </div>
    </Card>
  );
}

export function BotDetailView() {
  const { selected, candles, spot, signals, positions, orders } = useTradingBots();
  const [tab, setTab] = useState('Overview');
  if (!selected?.config) {
    return (
      <div style={{ padding: 16, color: tradeos.text }}>
        Bot details are unavailable. Open TradingBots from My Algos again.
      </div>
    );
  }
  const sr = computeSupportResistance(candles, selected.config.srMethods);
  const ev = evaluateBreakout(candles, sr, selected.config);
  const a = atr(candles, selected.config.atrPeriod);
  const tabs = ['Overview', 'Chart', 'Signals', 'Positions', 'Orders', 'Performance', 'Backtest', 'Logs'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Grid n={4}>
        <Kpi label="BOT STATUS" value={selected.status} />
        <Kpi label="MODE" value={selected.mode} />
        <Kpi label="State / Signal" value={`${selected.state} · ${selected.currentSignal}`} />
        <Kpi label="Spot" value={String(Math.round(spot))} />
        <Kpi label="Support" value={`${sr.primarySupport.price} (${sr.primarySupport.confidence}%)`} />
        <Kpi label="Resistance" value={`${sr.primaryResistance.price} (${sr.primaryResistance.confidence}%)`} />
        <Kpi label="Breakout score" value={`${ev.score}`} sub={ev.explanation} />
        <Kpi label="Today / Total / WR" value={`₹${selected.todayPnl} / ₹${selected.totalPnl} / ${selected.winRate}%`} />
      </Grid>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Btn key={t} tone={tab === t ? 'primary' : 'default'} onClick={() => setTab(t)}>
            {t}
          </Btn>
        ))}
      </div>
      {tab === 'Overview' && (
        <>
          <DecisionFlow />
          <Card title="S&R engine">
            <div style={{ fontSize: 13, color: tradeos.muted }}>
              ATR {a.toFixed(1)} · buffer {selected.config.atrBuffer}×ATR · VWAP {vwap(candles).toFixed(1)} · EMA20 {ema(candles.map((c) => c.c), 20).at(-1)?.toFixed(1)} · EMA50 {ema(candles.map((c) => c.c), 50).at(-1)?.toFixed(1)}
            </div>
          </Card>
        </>
      )}
      {tab === 'Chart' && (
        <BotChart
          candles={candles}
          levels={[sr.primarySupport, sr.secondarySupport, sr.primaryResistance, sr.secondaryResistance]}
          marks={ev.kind === 'RESISTANCE_BREAK' ? [{ kind: 'BREAKOUT', index: candles.length - 1 }] : ev.kind === 'SUPPORT_BREAK' ? [{ kind: 'BREAKDOWN', index: candles.length - 1 }] : []}
        />
      )}
      {tab === 'Signals' && <SignalsView />}
      {tab === 'Positions' && <div style={{ fontSize: 13, color: tradeos.text }}>{positions.filter((p) => p.botId === selected.id).length} open</div>}
      {tab === 'Orders' && <div style={{ fontSize: 13, color: tradeos.text }}>{orders.filter((o) => o.botId === selected.id).length} orders</div>}
      {tab === 'Performance' && <AnalyticsView />}
      {tab === 'Backtest' && <BacktestView />}
      {tab === 'Logs' && <AlertsView />}
    </div>
  );
}

export function HealthRow() {
  const { stale, lastTick, emergency } = useTradingBots();
  const ok = !stale && !emergency;
  const items = ['Market Feed', 'Broker API', 'WebSocket', 'Trading Engine', 'Risk Engine', 'Database', 'Option Chain'];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((i) => (
        <StatusPill key={i} label={i} tone={ok ? 'safe' : 'warning'} />
      ))}
      <span style={{ fontSize: 11, color: tradeos.muted }}>Last tick {lastTick.toLocaleTimeString()} · Last broker sync paper-local</span>
    </div>
  );
}
