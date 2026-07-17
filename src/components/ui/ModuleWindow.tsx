import { ReactNode } from 'react';
import { MacWindow } from './mac-window';

interface ModuleWindowProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  cascadeIndex?: number;
  /** Pin above other Mac windows (still below TopBar / Algos menu). */
  alwaysOnTop?: boolean;
}

/** Shared Mac-window chrome for every dashboard module — full-width main column. */
export function ModuleWindow({
  id,
  title,
  subtitle,
  icon,
  children,
  className,
  cascadeIndex = 0,
  alwaysOnTop = false
}: ModuleWindowProps) {
  return (
    <MacWindow
      windowId={id}
      title={title}
      subtitle={subtitle || 'Main window · resize height · click to focus'}
      icon={icon}
      className={`w-full max-w-none ${className || ''}`}
      initialWidth={1100}
      initialHeight={720}
      minWidth={640}
      minHeight={520}
      initialPosition={{ x: 96 + cascadeIndex * 28, y: 80 + cascadeIndex * 28 }}
      defaultMode="inline"
      fitMain
      reopenLabel={`Open ${title}`}
      alwaysOnTop={alwaysOnTop}
    >
      <div className="h-full min-h-0 w-full max-w-none p-4" style={{ boxSizing: 'border-box' }}>
        {children}
      </div>
    </MacWindow>
  );
}
