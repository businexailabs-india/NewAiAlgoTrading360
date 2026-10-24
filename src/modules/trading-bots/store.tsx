import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  AuditEvent,
  BotAlert,
  BotConfig,
  BotOrder,
  BotPosition,
  DeskMode,
  JournalRow,
  LiveSignal,
  TradingBot,
  TradingBotsPage
} from './types';
import { SEED_ALERTS, SEED_BOTS, SEED_JOURNAL, SEED_ORDERS, SEED_POSITIONS, defaultConfig } from './seed';
import { buildSessionCandles, type Candle } from './engine/market';
import { computeSupportResistance } from './engine/sr';
import { evaluateBreakout } from './engine/signals';
import { buildOptionChain, lotSize, selectBearCall, selectBullPut, sizeQuantity } from './engine/options';
import { evaluateRisk } from './engine/risk';
import { PaperBroker, StubLiveAdapter, type BrokerAdapter } from './engine/paper-broker';

export const PAGE_FROM_SECTION: Record<string, TradingBotsPage> = {
  'trading-bots': 'dashboard',
  'tb-dashboard': 'dashboard',
  'tb-marketplace': 'dashboard',
  'tb-option-chain': 'option-chain',
  'tb-positions': 'positions',
  'tb-orders': 'orders',
  'tb-journal': 'journal',
  'tb-analytics': 'analytics',
  'tb-alerts': 'alerts',
  'tb-config': 'dashboard',
  'tb-bot-detail': 'bot-detail'
};

interface Store {
  page: TradingBotsPage;
  setPage: (p: TradingBotsPage) => void;
  bots: TradingBot[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: TradingBot;
  deskMode: DeskMode;
  requestLive: () => string;
  setPaper: () => void;
  emergency: boolean;
  killSwitch: (confirm: boolean) => void;
  resumeAfterKill: () => void;
  candles: Candle[];
  spot: number;
  signals: LiveSignal[];
  positions: BotPosition[];
  orders: BotOrder[];
  journal: JournalRow[];
  alerts: BotAlert[];
  audit: AuditEvent[];
  stale: boolean;
  lastTick: Date;
  brokers: BrokerAdapter[];
  runSignalPass: () => void;
  setBotStatus: (id: string, status: TradingBot['status']) => void;
  cloneBot: (id: string) => void;
  saveConfig: (id: string, cfg: BotConfig) => void;
  createBot: (cfg: BotConfig) => void;
  askAssistant: (q: string) => string;
  selectedSignalId: string | null;
  setSelectedSignalId: (id: string | null) => void;
}

const Ctx = createContext<Store | null>(null);

function nid(p: string) {
  return `${p}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TradingBotsProvider({
  children,
  initialPage = 'dashboard',
  spotHint = 25250,
  initialSelectedId
}: {
  children: ReactNode;
  initialPage?: TradingBotsPage;
  spotHint?: number;
  initialSelectedId?: string;
}) {
  const [page, setPage] = useState<TradingBotsPage>(initialPage);
  const [bots, setBots] = useState<TradingBot[]>(SEED_BOTS);
  const [selectedId, setSelectedId] = useState(initialSelectedId || 'bot-sr-nifty');
  const [deskMode, setDeskMode] = useState<DeskMode>('PAPER');
  const [emergency, setEmergency] = useState(false);
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [positions, setPositions] = useState<BotPosition[]>(SEED_POSITIONS);
  const [orders, setOrders] = useState<BotOrder[]>(SEED_ORDERS);
  const [journal] = useState<JournalRow[]>(SEED_JOURNAL);
  const [alerts, setAlerts] = useState<BotAlert[]>(SEED_ALERTS);
  const [audit, setAudit] = useState<AuditEvent[]>([
    { id: 'u1', time: new Date().toISOString(), action: 'MODULE_OPEN', detail: 'TradingBots opened in PAPER mode' }
  ]);
  const [lastTick] = useState(() => new Date());
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const paper = useMemo(() => new PaperBroker(), []);
  const brokers = useMemo<BrokerAdapter[]>(
    () => [paper, new StubLiveAdapter('dhan', 'Dhan adapter', false), new StubLiveAdapter('fyers', 'Fyers adapter', false)],
    [paper]
  );

  const selected = bots.find((b) => b.id === selectedId) || bots[0] || (SEED_BOTS[0] as TradingBot);
  const candles = useMemo(
    () => buildSessionCandles(spotHint, 78, selected?.config.underlying.length || 7),
    [spotHint, selected?.config.underlying]
  );
  const spot = candles.at(-1)?.c || spotHint;
  const stale = Date.now() - lastTick.getTime() > 30_000;

  const pushAudit = (action: string, detail: string) =>
    setAudit((a) => [{ id: nid('aud'), time: new Date().toISOString(), action, detail }, ...a].slice(0, 80));

  const requestLive = () => {
    const connected = brokers.some((b) => b.id !== 'paper' && b.connected);
    if (!connected) {
      return 'LIVE blocked: connect a broker in Broker Connections and keep paper as default until both are confirmed.';
    }
    return 'LIVE blocked in TradingBots until multi-leg live adapter is explicitly enabled. Desk remains PAPER.';
  };

  const killSwitch = (confirm: boolean) => {
    if (!confirm) return;
    setEmergency(true);
    setBots((list) => list.map((b) => ({ ...b, status: 'HALTED', state: 'HALTED' })));
    setOrders((list) => list.map((o) => (o.state === 'SUBMITTED' || o.state === 'CREATED' ? { ...o, state: 'CANCELLED' } : o)));
    setAlerts((a) => [{ id: nid('al'), time: new Date().toLocaleTimeString(), type: 'Bot Halted', message: 'EMERGENCY STOP — new orders blocked', severity: 'crit' }, ...a]);
    pushAudit('EMERGENCY_STOP', 'Kill switch confirmed. Pending entries cancelled. Existing paper positions follow emergency policy (hold defined-risk).');
  };

  const runSignalPass = useCallback(() => {
    if (emergency || stale) {
      setAlerts((a) => [
        { id: nid('al'), time: new Date().toLocaleTimeString(), type: 'Market Feed Stale', message: stale ? 'Stale data — new trades blocked' : 'Kill switch active', severity: 'crit' },
        ...a
      ]);
      return;
    }
    const bot = bots.find((b) => b.id === selectedId);
    if (!bot || bot.status !== 'RUNNING') return;
    const sr = computeSupportResistance(candles, bot.config.srMethods);
    const ev = evaluateBreakout(candles, sr, bot.config);
    const chain = buildOptionChain(spot);
    const spread =
      ev.kind === 'RESISTANCE_BREAK' ? selectBullPut(spot, bot.config, chain) : ev.kind === 'SUPPORT_BREAK' ? selectBearCall(spot, bot.config, chain) : null;
    const risk = evaluateRisk(
      bot.config,
      bot.todayPnl,
      positions.reduce((s, p) => s + p.maxRisk * p.qty, 0),
      0
    );
    let status: LiveSignal['status'] = 'WAITING';
    let reject: string | undefined;
    if (ev.kind === 'NONE') status = 'WAITING';
    else if (!ev.eligible) status = ev.score >= 40 ? 'WATCH' : 'REJECTED';
    else if (risk.halted) {
      status = 'REJECTED';
      reject = risk.haltReason;
    } else if (!spread) {
      status = 'REJECTED';
      reject = 'Insufficient liquidity or no defined-risk spread at target delta.';
    } else status = 'TRADE_ELIGIBLE';

    const sig: LiveSignal = {
      id: nid('sig'),
      time: new Date().toLocaleTimeString(),
      botId: bot.id,
      underlying: bot.config.underlying,
      spot: Math.round(spot),
      support: sr.primarySupport.price,
      resistance: sr.primaryResistance.price,
      kind: ev.kind,
      score: ev.score,
      strategy: spread ? (spread.type === 'BULL_PUT' ? 'BULL PUT SPREAD' : 'BEAR CALL SPREAD') : 'NO TRADE',
      expiry: spread?.expiry || '—',
      shortStrike: spread?.shortStrike || 0,
      hedgeStrike: spread?.longStrike || 0,
      risk: spread?.maxLoss || 0,
      status,
      breakdown: ev.breakdown,
      rejectReason: reject,
      explanation: ev.explanation
    };
    setSignals((s) => [sig, ...s].slice(0, 40));
    setBots((list) =>
      list.map((b) =>
        b.id !== bot.id
          ? b
          : {
              ...b,
              currentSignal: status,
              state: status === 'TRADE_ELIGIBLE' ? (ev.kind === 'RESISTANCE_BREAK' ? 'BULLISH' : 'BEARISH') : b.state,
              status: risk.halted ? 'HALTED' : b.status
            }
      )
    );

    if (status === 'TRADE_ELIGIBLE' && spread && deskMode === 'PAPER') {
      const lot = lotSize(bot.config.underlying);
      const qty = sizeQuantity(bot.config.capital, bot.config.riskPct, spread.maxLoss, lot);
      void paper.submitSpread(spread, qty).then((res) => {
        const order: BotOrder = {
          id: nid('ord'),
          botId: bot.id,
          time: new Date().toLocaleTimeString(),
          legs: `${spread.type} ${spread.shortStrike}/${spread.longStrike}`,
          qty,
          state: res.state,
          mode: 'PAPER',
          note: res.note
        };
        setOrders((o) => [order, ...o]);
        if (res.state === 'FILLED' && qty > 0) {
          setPositions((p) => [
            {
              id: nid('pos'),
              botId: bot.id,
              underlying: bot.config.underlying,
              strategy: spread.type === 'BULL_PUT' ? 'Bull Put Spread' : 'Bear Call Spread',
              expiry: spread.expiry,
              shortStrike: spread.shortStrike,
              longStrike: spread.longStrike,
              qty,
              entryCredit: spread.netCredit,
              currentSpread: spread.netCredit * 0.55,
              pnl: (spread.netCredit - spread.netCredit * 0.55) * qty,
              pnlPct: 45,
              delta: spread.delta,
              theta: spread.theta,
              maxRisk: spread.maxLoss,
              status: 'OPEN',
              mode: 'PAPER'
            },
            ...p
          ]);
        }
      });
    }
  }, [bots, candles, deskMode, emergency, paper, positions, selectedId, spot, stale]);

  const askAssistant = (q: string) => {
    const bot = selected;
    if (!bot) return 'No bot selected.';
    const last = signals[0];
    const lower = q.toLowerCase();
    if (lower.includes('support') || lower.includes('resistance')) {
      const sr = computeSupportResistance(candles, bot.config.srMethods);
      return `Primary support ${sr.primarySupport.price} (${sr.primarySupport.confidence}% · ${sr.primarySupport.method}). Primary resistance ${sr.primaryResistance.price} (${sr.primaryResistance.confidence}% · ${sr.primaryResistance.method}).`;
    }
    if (lower.includes('reject')) return last?.rejectReason || last?.explanation || 'No rejected signal in the latest pass.';
    if (lower.includes('enter') || lower.includes('why')) return last?.explanation || 'No entry yet — waiting for confirmed breakout.';
    if (lower.includes('strike')) return 'Strikes are chosen by target delta and defined-risk width. AI ranking cannot bypass max loss, liquidity, or daily limits.';
    if (lower.includes('risk')) {
      const r = evaluateRisk(bot.config, bot.todayPnl, positions.reduce((s, p) => s + p.maxRisk * p.qty, 0), 0);
      return `Trading capital ₹${r.tradingCapital.toLocaleString('en-IN')}. Open risk ₹${Math.round(r.openRisk).toLocaleString('en-IN')}. Daily halt: ${r.halted ? 'YES' : 'no'}.`;
    }
    if (lower.includes('exit')) return 'Exits: profit target %, stop, technical invalidation, opposite confirmed signal, time/EOD, expiry risk, daily loss, emergency stop. Failed breakout → COOLDOWN, not an instant reverse spread.';
    if (lower.includes('perform')) return `${bot.config.name}: win rate ${bot.winRate}%, total P&L ₹${bot.totalPnl.toLocaleString('en-IN')}, today ₹${bot.todayPnl.toLocaleString('en-IN')}.`;
    return 'I can explain entries, rejects, strikes, S/R, risk, exits, and performance. I cannot change risk limits, the kill switch, or broker controls.';
  };

  const value: Store = {
    page,
    setPage,
    bots,
    selectedId,
    setSelectedId,
    selected,
    deskMode,
    requestLive,
    setPaper: () => setDeskMode('PAPER'),
    emergency,
    killSwitch,
    resumeAfterKill: () => {
      setEmergency(false);
      pushAudit('KILL_RELEASE', 'Emergency cleared. Bots remain STOPPED until started.');
      setBots((list) => list.map((b) => ({ ...b, status: 'STOPPED', state: 'NEUTRAL' })));
    },
    candles,
    spot,
    signals,
    positions,
    orders,
    journal,
    alerts,
    audit,
    stale,
    lastTick,
    brokers,
    runSignalPass,
    setBotStatus: (id, status) => setBots((list) => list.map((b) => (b.id === id ? { ...b, status, state: status === 'HALTED' ? 'HALTED' : b.state } : b))),
    cloneBot: (id) => {
      const src = bots.find((b) => b.id === id);
      if (!src) return;
      const copy: TradingBot = {
        ...src,
        id: nid('bot'),
        status: 'STOPPED',
        mode: 'PAPER',
        config: { ...src.config, name: `${src.config.name} (clone)`, version: 1 }
      };
      setBots((list) => [...list, copy]);
    },
    saveConfig: (id, cfg) =>
      setBots((list) => list.map((b) => (b.id === id ? { ...b, config: { ...cfg, version: cfg.version + 1 } } : b))),
    createBot: (cfg) => {
      const b: TradingBot = {
        id: nid('bot'),
        config: defaultConfig(cfg),
        status: 'STOPPED',
        mode: 'PAPER',
        state: 'NEUTRAL',
        todayPnl: 0,
        totalPnl: 0,
        winRate: 0,
        trades: 0,
        currentSignal: 'NONE',
        riskLevel: 'LOW',
        createdAt: new Date().toISOString().slice(0, 10)
      };
      setBots((list) => [...list, b]);
      setSelectedId(b.id);
    },
    askAssistant,
    selectedSignalId,
    setSelectedSignalId
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTradingBots() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTradingBots must be used within TradingBotsProvider');
  return ctx;
}
