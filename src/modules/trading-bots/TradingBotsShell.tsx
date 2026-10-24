import { useEffect, useState } from 'react';
import { Bot, OctagonX } from 'lucide-react';
import { tradeos } from '@/components/tradeos/tokens';
import { PAGE_FROM_SECTION, TradingBotsProvider, useTradingBots } from './store';
import type { TradingBotsPage } from './types';
import { Btn, Card } from './ui';
import {
  AlertsView,
  AnalyticsView,
  BotDetailView,
  DashboardView,
  HealthRow,
  JournalView,
  OptionChainView,
  OrdersView,
  PositionsView
} from './views';
import { useMarketData } from '@/contexts/MarketDataContext';

export const TB_NAV: { id: string; page: TradingBotsPage; label: string }[] = [
  { id: 'tb-dashboard', page: 'dashboard', label: 'Dashboard' },
  { id: 'tb-option-chain', page: 'option-chain', label: 'Option Chain' },
  { id: 'tb-positions', page: 'positions', label: 'Positions' },
  { id: 'tb-orders', page: 'orders', label: 'Orders' },
  { id: 'tb-journal', page: 'journal', label: 'Trade Journal' },
  { id: 'tb-analytics', page: 'analytics', label: 'Analytics' },
  { id: 'tb-alerts', page: 'alerts', label: 'Alerts' }
];

function Inner({
  section,
  onSection,
  embedded,
  focusBotId
}: {
  section?: string;
  onSection?: (s: string) => void;
  embedded?: boolean;
  focusBotId?: string;
}) {
  const { page, setPage, setSelectedId, emergency, killSwitch, resumeAfterKill, deskMode, askAssistant } = useTradingBots();
  const [confirmKill, setConfirmKill] = useState(false);
  const [q, setQ] = useState('Why did the bot enter?');
  const [a, setA] = useState('');

  useEffect(() => {
    if (!section) return;
    const p = PAGE_FROM_SECTION[section];
    if (p) setPage(p);
  }, [section, setPage]);

  useEffect(() => {
    if (!focusBotId) return;
    setSelectedId(focusBotId);
    setPage('bot-detail');
  }, [focusBotId, setPage, setSelectedId]);

  const go = (item: (typeof TB_NAV)[number]) => {
    setPage(item.page);
    onSection?.(item.id);
  };

  const body = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardView />;
      case 'option-chain':
        return <OptionChainView />;
      case 'positions':
        return <PositionsView />;
      case 'orders':
        return <OrdersView />;
      case 'journal':
        return <JournalView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'alerts':
        return <AlertsView />;
      case 'bot-detail':
        return <BotDetailView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: embedded ? 560 : 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot className="h-4 w-4 text-cyan-300" />
          <span style={{ fontWeight: 700, color: tradeos.text }}>TradingBots</span>
          <span style={{ fontSize: 12, color: tradeos.muted }}>{deskMode} · Support & Resistance Hedging</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {emergency ? (
            <Btn onClick={resumeAfterKill}>Clear emergency (bots stay STOPPED)</Btn>
          ) : (
            <Btn tone="danger" onClick={() => setConfirmKill(true)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <OctagonX className="h-3.5 w-3.5" /> EMERGENCY STOP
              </span>
            </Btn>
          )}
        </div>
      </div>
      {confirmKill ? (
        <Card title="Confirm emergency stop">
          <div style={{ fontSize: 13, color: tradeos.muted, marginBottom: 10 }}>
            Prevents new orders, cancels pending entries, holds defined-risk paper positions, writes an audit event.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              tone="danger"
              onClick={() => {
                killSwitch(true);
                setConfirmKill(false);
              }}
            >
              Confirm halt
            </Btn>
            <Btn onClick={() => setConfirmKill(false)}>Cancel</Btn>
          </div>
        </Card>
      ) : null}
      <HealthRow />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TB_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 11,
              cursor: 'pointer',
              border: page === item.page ? `1px solid ${tradeos.teal}` : `1px solid ${tradeos.cardBorder}`,
              background: page === item.page ? 'rgba(45,212,191,0.12)' : 'transparent',
              color: page === item.page ? tradeos.teal : tradeos.muted
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {body()}
      <Card title="AI Trading Assistant (explain only)">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: `1px solid ${tradeos.cardBorder}`, color: tradeos.text, borderRadius: 8, padding: 8, fontSize: 13 }}
          />
          <Btn tone="primary" onClick={() => setA(askAssistant(q))}>
            Ask
          </Btn>
        </div>
        {a ? <div style={{ marginTop: 8, fontSize: 13, color: tradeos.text, lineHeight: 1.5 }}>{a}</div> : null}
      </Card>
    </div>
  );
}

export function TradingBotsShell({
  section,
  onSection,
  embedded,
  focusBotId
}: {
  section?: string;
  onSection?: (s: string) => void;
  embedded?: boolean;
  focusBotId?: string;
}) {
  const md = useMarketData();
  const nifty = md.indices.find((i) => i.name.toUpperCase().includes('NIFTY') && !i.name.toUpperCase().includes('BANK'));
  const spot = nifty?.value || 25250;
  const initial = focusBotId
    ? 'bot-detail'
    : PAGE_FROM_SECTION[section || 'tb-dashboard'] || 'dashboard';
  const inner = (
    <Inner section={section} onSection={onSection} embedded={embedded} focusBotId={focusBotId} />
  );
  if (embedded) return inner;
  return (
    <TradingBotsProvider initialPage={initial} spotHint={spot} initialSelectedId={focusBotId}>
      {inner}
    </TradingBotsProvider>
  );
}
