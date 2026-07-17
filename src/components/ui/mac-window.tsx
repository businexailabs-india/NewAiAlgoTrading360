import { PointerEvent as ReactPointerEvent, ReactNode, useCallback, useRef, useState } from 'react';

type WindowMode = 'inline' | 'floating' | 'maximized';

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
}

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
  reopenLabel
}: MacWindowProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<WindowMode>('inline');
  const [closed, setClosed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 112, y: 84 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', stopDrag);
  // Functions are stable for the lifetime of an active pointer gesture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveDrag = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return;
    setPosition({
      x: Math.min(
        Math.max(80, dragRef.current.left + event.clientX - dragRef.current.x),
        window.innerWidth - 160
      ),
      y: Math.min(
        Math.max(68, dragRef.current.top + event.clientY - dragRef.current.y),
        window.innerHeight - 54
      )
    });
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === 'maximized' || (event.target as HTMLElement).closest('button')) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (mode === 'inline') {
      setSize({ width: Math.max(minWidth, rect.width), height: Math.max(minHeight, rect.height) });
      setPosition({ x: rect.left, y: rect.top });
      setMode('floating');
    }
    dragRef.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', stopDrag);
  };

  const stopResize = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('pointermove', moveResize);
    window.removeEventListener('pointerup', stopResize);
  // Functions are stable for the lifetime of an active pointer gesture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveResize = useCallback(
    (event: PointerEvent) => {
      if (!resizeRef.current) return;
      setSize({
        width: Math.min(
          Math.max(minWidth, resizeRef.current.width + event.clientX - resizeRef.current.x),
          window.innerWidth - position.x - 16
        ),
        height: Math.min(
          Math.max(minHeight, resizeRef.current.height + event.clientY - resizeRef.current.y),
          window.innerHeight - position.y - 16
        )
      });
    },
    [minHeight, minWidth, position.x, position.y]
  );

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (mode === 'inline') {
      setPosition({ x: rect.left, y: rect.top });
      setMode('floating');
    }
    resizeRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height
    };
    window.addEventListener('pointermove', moveResize);
    window.addEventListener('pointerup', stopResize);
  };

  const toggleMaximize = () => {
    setMinimized(false);
    setMode((current) => (current === 'maximized' ? 'inline' : 'maximized'));
  };

  if (closed) {
    return (
      <button
        type="button"
        onClick={() => setClosed(false)}
        className="fixed bottom-5 right-5 z-[160] rounded-full border border-cyan-300/40 bg-slate-900/95 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.3)]"
      >
        {reopenLabel || `Open ${title}`}
      </button>
    );
  }

  const floating = mode !== 'inline';
  const style =
    mode === 'maximized'
      ? { left: 96, right: 16, top: 72, bottom: 16 }
      : mode === 'floating'
        ? {
            left: position.x,
            top: position.y,
            width: size.width,
            height: minimized ? 'auto' : size.height
          }
        : undefined;

  return (
    <div
      ref={frameRef}
      style={style}
      className={`${floating ? 'fixed z-[150]' : 'relative w-full'} neon-card overflow-hidden rounded-2xl ${className}`}
    >
      <div
        onPointerDown={startDrag}
        onDoubleClick={toggleMaximize}
        className={`flex select-none items-center justify-between gap-4 border-b border-white/10 bg-slate-950/55 px-4 py-3 ${
          mode === 'maximized' ? '' : 'cursor-move'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2" aria-label="Window controls">
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={() => setClosed(true)}
              className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ff5f57] shadow-[0_0_7px_rgba(255,95,87,0.45)]"
            >
              <span className="text-[8px] leading-none text-red-950 opacity-0 group-hover:opacity-100">×</span>
            </button>
            <button
              type="button"
              title={minimized ? 'Restore' : 'Minimize'}
              aria-label={minimized ? 'Restore' : 'Minimize'}
              onClick={() => setMinimized((value) => !value)}
              className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#febc2e] shadow-[0_0_7px_rgba(254,188,46,0.4)]"
            >
              <span className="text-[8px] leading-none text-amber-950 opacity-0 group-hover:opacity-100">−</span>
            </button>
            <button
              type="button"
              title={mode === 'maximized' ? 'Restore' : 'Maximize'}
              aria-label={mode === 'maximized' ? 'Restore' : 'Maximize'}
              onClick={toggleMaximize}
              className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#28c840] shadow-[0_0_7px_rgba(40,200,64,0.4)]"
            >
              <span className="text-[7px] leading-none text-green-950 opacity-0 group-hover:opacity-100">↗</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/10" />
          {icon}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            {subtitle && <div className="truncate text-[11px] text-slate-400">{subtitle}</div>}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {mode === 'maximized' ? 'Full screen' : mode === 'floating' ? 'Floating' : 'Dashboard'}
        </div>
      </div>

      {!minimized && (
        <div className={floating ? 'h-[calc(100%-57px)] overflow-auto' : ''}>{children}</div>
      )}

      {!minimized && mode !== 'maximized' && (
        <div
          onPointerDown={startResize}
          className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
          aria-label="Resize window"
        >
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-cyan-300/60" />
        </div>
      )}
    </div>
  );
}
