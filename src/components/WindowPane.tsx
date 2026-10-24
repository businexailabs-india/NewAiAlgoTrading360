import { LayoutGrid, Maximize2, Minus, PanelRightClose, PanelRightOpen, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWindowStack, WindowPaneEntry } from '../contexts/WindowStackContext';
import { TOP_CHROME_H } from './TopBar';
import { MARKET_TICKER_H } from './algos/MarketTickerBar';
import { useTheme } from '../contexts/ThemeContext';

function statusMeta(status: WindowPaneEntry['status']) {
  if (status === 'minimized') {
    return {
      label: 'Minimized',
      className: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
      Icon: Minus
    };
  }
  return {
    label: 'Closed',
    className: 'border-slate-400/25 bg-white/5 text-slate-300',
    Icon: Square
  };
}

/** Always docked on the RIGHT — opposite the left sidebar menu. */
const WINDOW_PANE_W = 272;
const WINDOW_PANE_COLLAPSED_W = 48;
/** Space between main desktop scrollbar and the Window Pane. */
const SCROLLBAR_GAP = 14;

const paneShell = {
  position: 'fixed' as const,
  top: TOP_CHROME_H + MARKET_TICKER_H + 12,
  right: 0,
  bottom: 16,
  // Below active Mac windows (z starts ~140) so scan/buttons stay clickable;
  // still above page content. Top bar remains higher (~300).
  zIndex: 90,
  display: 'flex',
  flexDirection: 'column' as const,
  minHeight: 0
};

export function WindowPane() {
  const { paneEntries, restoreWindow } = useWindowStack();
  const { theme } = useTheme();
  const light = theme === 'light';
  // Collapsed by default so main windows can use full width; expand when needed.
  const [collapsed, setCollapsed] = useState(true);

  // Push main desktop left of this pane so the scrollbar is never covered.
  useEffect(() => {
    const inset =
      (collapsed ? WINDOW_PANE_COLLAPSED_W : WINDOW_PANE_W) + SCROLLBAR_GAP;
    document.documentElement.style.setProperty('--window-pane-inset', `${inset}px`);
    return () => {
      document.documentElement.style.removeProperty('--window-pane-inset');
    };
  }, [collapsed]);

  const minimized = paneEntries.filter((e) => e.status === 'minimized');
  const closed = paneEntries.filter((e) => e.status === 'closed');

  if (collapsed) {
    return (
      <aside
        className={`flex flex-col items-center gap-3 rounded-2xl border py-3 ${light ? 'border-slate-200 bg-white shadow-md' : 'border-white/10 bg-slate-950/90 shadow-[0_0_24px_rgba(34,211,238,0.15)] backdrop-blur-xl'}`}
        style={{ ...paneShell, width: WINDOW_PANE_COLLAPSED_W }}
      >
        <button
          type="button"
          title="Expand window pane"
          onClick={() => setCollapsed(false)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border ${light ? 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100' : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20'}`}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div
          className="flex flex-col items-center gap-2 px-1"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        >
          {paneEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`Restore ${entry.title}`}
              onClick={() => restoreWindow(entry.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] font-bold ${
                entry.status === 'minimized'
                  ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                  : 'border-white/15 bg-white/5 text-slate-300'
              }`}
            >
              {entry.title.slice(0, 1).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-500">{paneEntries.length}</div>
      </aside>
    );
  }

  return (
    <aside
        className={`flex flex-col overflow-hidden rounded-2xl border ${light ? 'border-slate-200 bg-white shadow-md' : 'border-white/10 bg-slate-950/90 shadow-[0_0_28px_rgba(34,211,238,0.18)] backdrop-blur-xl'}`}
      style={{ ...paneShell, width: WINDOW_PANE_W }}
    >
      <header
        className={`flex items-center justify-between gap-2 border-b px-3 py-3 ${light ? 'border-slate-200' : 'border-cyan-300/25'}`}
        style={{
          background: light
            ? '#ffffff'
            : 'linear-gradient(90deg, rgba(8,47,73,0.96) 0%, rgba(15,23,42,0.98) 55%, rgba(6,78,59,0.45) 100%)',
          boxShadow: light ? 'none' : 'inset 0 -1px 0 rgba(34,211,238,0.16)'
        }}
      >
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-sm font-semibold ${light ? 'text-slate-900' : 'text-white'}`}>
            <LayoutGrid className="h-4 w-4 text-cyan-300" />
            Window Pane
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">Minimized & closed windows</p>
        </div>
        <button
          type="button"
          title="Collapse pane"
          onClick={() => setCollapsed(true)}
          className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </header>

      <div
        className="space-y-4 p-3"
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <section>
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
            <span>Minimized</span>
            <span>{minimized.length}</span>
          </div>
          <div className="space-y-2">
            {minimized.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                No minimized windows
              </div>
            )}
            {minimized.map((entry) => (
              <PaneRow key={entry.id} entry={entry} onRestore={() => restoreWindow(entry.id)} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
            <span>Closed</span>
            <span>{closed.length}</span>
          </div>
          <div className="space-y-2">
            {closed.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                No closed windows
              </div>
            )}
            {closed.map((entry) => (
              <PaneRow key={entry.id} entry={entry} onRestore={() => restoreWindow(entry.id)} />
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
        Click a tile to restore · {paneEntries.length} parked
      </footer>
    </aside>
  );
}

function PaneRow({ entry, onRestore }: { entry: WindowPaneEntry; onRestore: () => void }) {
  const meta = statusMeta(entry.status);
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onRestore}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.className}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{entry.title}</span>
        <span className="block truncate text-[11px] text-slate-400">
          {entry.subtitle || meta.label}
        </span>
      </span>
      <Maximize2 className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-cyan-300" />
    </button>
  );
}
