import {
  PointerEvent as ReactPointerEvent,
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';
import { flushSync } from 'react-dom';
import { useWindowStack } from '../../contexts/WindowStackContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TOP_CHROME_H } from '../TopBar';
import { MARKET_TICKER_H } from '../algos/MarketTickerBar';

type WindowMode = 'inline' | 'floating' | 'maximized';
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface MacWindowProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  reopenLabel?: string;
  defaultMode?: WindowMode;
  startClosed?: boolean;
  popupToken?: number;
  initialPosition?: { x: number; y: number };
  windowId?: string;
  /** Keep above other Mac windows (below TopBar / Algos menu). */
  alwaysOnTop?: boolean;
  /** White window body (My Algos / Algos Live). */
  light?: boolean;
  /**
   * Keep window in the main desktop column (full width, no float-away).
   * Default true when defaultMode is inline. DhanLaxmi stays separate (always floating).
   */
  fitMain?: boolean;
}

/** Top menu + index ticker + MCX commodity ticker. */
const TOP_BAR_H = TOP_CHROME_H + MARKET_TICKER_H;
const SIDEBAR_W = 80;

export function MacWindow({
  title,
  subtitle,
  icon,
  children,
  className = '',
  initialWidth = 760,
  initialHeight = 560,
  minWidth = 360,
  minHeight = 280,
  reopenLabel,
  defaultMode = 'inline',
  startClosed = false,
  popupToken = 0,
  initialPosition,
  windowId,
  alwaysOnTop = false,
  fitMain,
  light: lightProp
}: MacWindowProps) {
  const { theme } = useTheme();
  const light = lightProp ?? theme === 'light';
  const reactId = useId();
  const id = windowId || reactId;
  const lockMain = fitMain ?? defaultMode === 'inline';
  const {
    claimZIndex,
    cascadeOffset,
    registerWindow,
    updateWindowStatus,
    unregisterWindow,
    getRestoreToken,
    getCloseToken
  } = useWindowStack();
  const frameRef = useRef<HTMLDivElement>(null);
  const bumpZ = useCallback(() => claimZIndex(alwaysOnTop), [claimZIndex, alwaysOnTop]);

  const cascade = cascadeOffset(id);
  const [mode, setMode] = useState<WindowMode>(() =>
    lockMain && defaultMode === 'floating' ? 'inline' : defaultMode
  );
  const [closed, setClosed] = useState(startClosed);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState(
    initialPosition ?? { x: cascade.x, y: cascade.y }
  );
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [userSized, setUserSized] = useState(false);
  const [zIndex, setZIndex] = useState(() => claimZIndex(alwaysOnTop));
  const lastPopupToken = useRef(popupToken);
  const lastRestoreToken = useRef(getRestoreToken(id));
  const lastCloseToken = useRef(getCloseToken(id));

  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    registerWindow({
      id,
      title,
      subtitle,
      status: startClosed ? 'closed' : 'open'
    });
    return () => unregisterWindow(id);
  }, [id, title, subtitle, startClosed, registerWindow, unregisterWindow]);

  useEffect(() => {
    const status = closed ? 'closed' : minimized ? 'minimized' : 'open';
    updateWindowStatus(id, status);
  }, [id, closed, minimized, updateWindowStatus]);

  useEffect(() => {
    const token = getRestoreToken(id);
    if (token === lastRestoreToken.current) return;
    lastRestoreToken.current = token;
    if (!token) return;
    setClosed(false);
    setMinimized(false);
    setMode(lockMain ? 'inline' : defaultMode);
    if (lockMain) setUserSized(false);
    setZIndex(bumpZ());
  }, [id, getRestoreToken, bumpZ, defaultMode, lockMain]);

  useEffect(() => {
    const token = getCloseToken(id);
    if (token === lastCloseToken.current) return;
    lastCloseToken.current = token;
    if (!token) return;
    setClosed(true);
    setMinimized(false);
  }, [id, getCloseToken]);

  const bringToFront = useCallback(() => {
    setZIndex(bumpZ());
  }, [bumpZ]);

  // Main desktop windows stay in-flow (fit) — never leave them stuck floating.
  useEffect(() => {
    if (lockMain && mode === 'floating') {
      setMode('inline');
      setUserSized(false);
    }
  }, [lockMain, mode]);

  useEffect(() => {
    if (popupToken === lastPopupToken.current) return;
    lastPopupToken.current = popupToken;
    if (!popupToken) return;
    setClosed(false);
    setMinimized(false);
    const nextMode = lockMain ? 'inline' : defaultMode;
    setMode(nextMode);
    if (lockMain) setUserSized(false);
    if (nextMode === 'floating') {
      setPosition(initialPosition ?? cascadeOffset(id));
    }
    setZIndex(bumpZ());
  }, [popupToken, initialPosition, cascadeOffset, id, bumpZ, defaultMode, lockMain]);

  // Auto-fit height in inline mode until user resizes.
  useEffect(() => {
    if (mode !== 'inline' || userSized || minimized || !frameRef.current) return;
    const el = frameRef.current;
    const apply = () => {
      const h = Math.max(minHeight, Math.min(el.scrollHeight, window.innerHeight - TOP_BAR_H - 48));
      setSize((s) => ({ ...s, width: el.offsetWidth || s.width, height: h }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, userSized, minimized, minHeight, children]);

  const liftToFloating = (rect: DOMRect) => {
    flushSync(() => {
      setPosition({ x: rect.left, y: Math.max(TOP_BAR_H + 8, rect.top) });
      setSize({
        width: Math.max(minWidth, Math.round(rect.width)),
        height: Math.max(minHeight, Math.round(rect.height))
      });
      setMode('floating');
      setUserSized(true);
      setZIndex(bumpZ());
    });
  };

  const onDragMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return;
    setPosition({
      x: Math.min(
        Math.max(SIDEBAR_W, dragRef.current.left + event.clientX - dragRef.current.x),
        window.innerWidth - 120
      ),
      y: Math.min(
        Math.max(TOP_BAR_H + 8, dragRef.current.top + event.clientY - dragRef.current.y),
        window.innerHeight - 48
      )
    });
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [onDragMove]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === 'maximized' || (event.target as HTMLElement).closest('button')) return;
    // Main desktop windows stay fitted in the column — no drag-to-float.
    if (lockMain && (mode === 'inline' || mode === 'maximized')) {
      bringToFront();
      return;
    }
    bringToFront();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (mode === 'inline') liftToFloating(rect);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: Math.max(TOP_BAR_H + 8, rect.top)
    };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const onResizeMove = useCallback(
    (event: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = event.clientX - r.startX;
      const dy = event.clientY - r.startY;
      let nextW = r.width;
      let nextH = r.height;
      let nextX = r.left;
      let nextY = r.top;
      const maxRight = window.innerWidth - 12;
      const maxBottom = window.innerHeight - 12;
      const minTop = TOP_BAR_H + 8;
      const minLeft = SIDEBAR_W;

      if (r.edge.includes('e')) {
        nextW = Math.max(minWidth, Math.min(r.width + dx, maxRight - r.left));
      }
      if (r.edge.includes('s')) {
        nextH = Math.max(minHeight, Math.min(r.height + dy, maxBottom - r.top));
      }
      if (r.edge.includes('w')) {
        const maxGrow = r.left - minLeft;
        const applied = Math.max(-maxGrow, Math.min(dx, r.width - minWidth));
        nextW = r.width - applied;
        nextX = r.left + applied;
      }
      if (r.edge.includes('n')) {
        const maxGrow = r.top - minTop;
        const applied = Math.max(-maxGrow, Math.min(dy, r.height - minHeight));
        nextH = r.height - applied;
        nextY = r.top + applied;
      }

      setSize({ width: Math.round(nextW), height: Math.round(nextH) });
      setPosition({ x: Math.round(nextX), y: Math.round(nextY) });
    },
    [minHeight, minWidth]
  );

  const stopResize = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
  }, [onResizeMove]);

  const startResize = (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Main desktop: height resize in-flow only (stay full width).
    if (lockMain && mode === 'inline') {
      if (!(edge === 's' || edge === 'n' || edge === 'se' || edge === 'sw' || edge === 'ne' || edge === 'nw')) {
        return;
      }
      setUserSized(true);
      setSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    } else if (mode === 'inline') {
      liftToFloating(rect);
    } else {
      setUserSized(true);
    }

    resizeRef.current = {
      edge: lockMain && mode === 'inline' ? (edge.includes('n') ? 'n' : 's') : edge,
      startX: event.clientX,
      startY: event.clientY,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(Math.max(TOP_BAR_H + 8, rect.top))
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
  };

  const toggleMaximize = () => {
    setMinimized(false);
    bringToFront();
    setMode((current) => {
      if (current === 'maximized') {
        if (lockMain) setUserSized(false);
        return lockMain ? 'inline' : defaultMode === 'floating' ? 'floating' : 'inline';
      }
      return 'maximized';
    });
  };

  if (closed || minimized) {
    return null;
  }

  const floating = mode !== 'inline';
  const frameLayout: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };
  const style: CSSProperties =
    mode === 'maximized'
      ? {
          ...frameLayout,
          left: SIDEBAR_W + 10,
          right: 'var(--window-pane-inset, 62px)',
          top: TOP_BAR_H + 8,
          bottom: 16,
          zIndex,
          width: 'auto',
          height: 'auto',
          ...(light ? { background: '#ffffff', border: '1px solid #cbd5e1' } : {})
        }
      : mode === 'floating'
        ? {
            ...frameLayout,
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
            zIndex
          }
        : {
            ...frameLayout,
            width: '100%',
            maxWidth: 'none',
            alignSelf: 'stretch',
            boxSizing: 'border-box',
            // Fit the main column under top chrome + ticker.
            height: lockMain && !userSized
              ? `calc(100vh - ${TOP_BAR_H + 24}px)`
              : userSized
                ? size.height
                : undefined,
            maxHeight: `calc(100vh - ${TOP_BAR_H + 24}px)`,
            minHeight: userSized ? undefined : minHeight,
            marginLeft: 0,
            marginRight: 0,
            ...(lockMain
              ? light
                ? {
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
                    background: '#ffffff'
                  }
                : {
                    border: '1px solid rgba(34, 211, 238, 0.55)',
                    boxShadow:
                      '0 0 0 1px rgba(34,211,238,0.12), 0 0 28px rgba(34,211,238,0.18), 0 18px 40px rgba(0,0,0,0.45)',
                    background: 'rgba(2, 8, 23, 0.96)'
                  }
              : {})
          };

  const grip = (edge: ResizeEdge, extra: CSSProperties) => (
    <div
      key={edge}
      onPointerDown={startResize(edge)}
      style={{
        position: 'absolute',
        zIndex: 20,
        touchAction: 'none',
        ...extra
      }}
      aria-label={`Resize ${edge}`}
    />
  );

  return (
    <div
      ref={frameRef}
      data-window-id={id}
      data-reopen-label={reopenLabel || title}
      style={style}
      onPointerDownCapture={bringToFront}
      className={`${floating ? 'fixed' : 'relative'} ${light ? '' : 'neon-card'} overflow-hidden rounded-2xl ${className}`}
    >
      <div
        onPointerDown={startDrag}
        onDoubleClick={toggleMaximize}
        className={mode === 'maximized' || lockMain ? '' : 'cursor-move'}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
          userSelect: 'none',
          padding: '12px 16px',
          borderBottom: light ? '1px solid #e2e8f0' : '1px solid rgba(34,211,238,0.25)',
          cursor: mode === 'maximized' || lockMain ? 'default' : 'move',
          background: light
            ? '#ffffff'
            : 'linear-gradient(90deg, rgba(8,47,73,0.96) 0%, rgba(15,23,42,0.98) 45%, rgba(6,78,59,0.55) 100%)',
          boxShadow: light
            ? 'none'
            : 'inset 0 -1px 0 rgba(34,211,238,0.18), 0 8px 18px rgba(0,0,0,0.25)'
        }}
      >
        {/* Title block — left */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
            flex: '1 1 auto'
          }}
        >
          {icon}
          <div style={{ minWidth: 0 }}>
            <div
              className="truncate text-sm font-semibold"
              style={{ color: light ? '#0f172a' : '#ffffff' }}
            >
              {title}
            </div>
            {subtitle && (
              <div className="truncate text-[11px]" style={{ color: light ? '#64748b' : '#94a3b8' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Min / max / close — right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            marginLeft: 'auto'
          }}
          aria-label="Window controls"
        >
          <button
            type="button"
            title={minimized ? 'Restore' : 'Minimize'}
            aria-label={minimized ? 'Restore' : 'Minimize'}
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((value) => !value);
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#febc2e] font-bold leading-none text-amber-950 ring-1 ring-black/25 shadow-[0_0_8px_rgba(254,188,46,0.55)] transition hover:brightness-110"
          >
            <span className="mt-[-1px] text-[11px] leading-none">{minimized ? '+' : '−'}</span>
          </button>
          <button
            type="button"
            title={mode === 'maximized' ? 'Restore' : 'Maximize'}
            aria-label={mode === 'maximized' ? 'Restore' : 'Maximize'}
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize();
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#28c840] font-bold leading-none text-green-950 ring-1 ring-black/25 shadow-[0_0_8px_rgba(40,200,64,0.55)] transition hover:brightness-110"
          >
            <span className="text-[9px] leading-none">{mode === 'maximized' ? '❐' : '＋'}</span>
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setClosed(true);
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5f57] font-bold leading-none text-red-950 ring-1 ring-black/25 shadow-[0_0_8px_rgba(255,95,87,0.6)] transition hover:brightness-110"
          >
            <span className="text-[10px] leading-none">×</span>
          </button>
        </div>
      </div>

      {!minimized && (
        <div
          className="mac-window-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            scrollbarGutter: 'stable'
          }}
        >
          {children}
        </div>
      )}

      {!minimized && mode !== 'maximized' && (
        <>
          {grip('n', { top: 0, left: 10, right: 10, height: 8, cursor: 'ns-resize' })}
          {grip('s', { bottom: 0, left: 10, right: 10, height: 8, cursor: 'ns-resize' })}
          {!lockMain && (
            <>
              {grip('e', { top: 10, right: 0, bottom: 10, width: 8, cursor: 'ew-resize' })}
              {grip('w', { top: 10, left: 0, bottom: 10, width: 8, cursor: 'ew-resize' })}
              {grip('ne', { top: 0, right: 0, width: 14, height: 14, cursor: 'nesw-resize' })}
              {grip('nw', { top: 0, left: 0, width: 14, height: 14, cursor: 'nwse-resize' })}
              {grip('se', { bottom: 0, right: 0, width: 16, height: 16, cursor: 'nwse-resize' })}
              {grip('sw', { bottom: 0, left: 0, width: 14, height: 14, cursor: 'nesw-resize' })}
            </>
          )}
          <div
            className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 rounded-sm border-b-2 border-r-2 border-cyan-300/90"
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
