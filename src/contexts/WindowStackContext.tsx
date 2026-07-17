import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react';

export type WindowPaneStatus = 'open' | 'minimized' | 'closed';

export interface WindowPaneEntry {
  id: string;
  title: string;
  subtitle?: string;
  status: WindowPaneStatus;
  restoreToken: number;
  /** Bumped by closeWindow so MacWindow can dismiss even when already closed in UI state. */
  closeToken: number;
  updatedAt: number;
}

interface WindowStackContextValue {
  /** Normal windows stay below Algos chrome. Pass pinned=true for Algos windows. */
  claimZIndex: (pinned?: boolean) => number;
  cascadeOffset: (windowId: string) => { x: number; y: number };
  registerWindow: (entry: { id: string; title: string; subtitle?: string; status: WindowPaneStatus }) => void;
  updateWindowStatus: (id: string, status: WindowPaneStatus) => void;
  unregisterWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  /** Force-close a Mac window (used when leaving a section). */
  closeWindow: (id: string) => void;
  paneEntries: WindowPaneEntry[];
  getRestoreToken: (id: string) => number;
  getCloseToken: (id: string) => number;
}

const WindowStackContext = createContext<WindowStackContextValue | null>(null);

/** Regular Mac windows — always below ticker (485) / top bar (500). */
const BASE_Z = 140;
const MAX_NORMAL_Z = 280;
/** Algos Live windows — above everything except top bar + ticker strip. */
const BASE_PINNED_Z = 400;
const MAX_PINNED_Z = 480;
const CASCADE_STEP = 28;

export function WindowStackProvider({ children }: { children: ReactNode }) {
  const zRef = useRef(BASE_Z);
  const pinnedZRef = useRef(BASE_PINNED_Z);
  const orderRef = useRef<string[]>([]);
  const [entries, setEntries] = useState<Record<string, WindowPaneEntry>>({});

  const claimZIndex = useCallback((pinned = false) => {
    if (pinned) {
      pinnedZRef.current = Math.min(MAX_PINNED_Z, pinnedZRef.current + 1);
      if (pinnedZRef.current >= MAX_PINNED_Z) pinnedZRef.current = BASE_PINNED_Z + 1;
      return pinnedZRef.current;
    }
    zRef.current = Math.min(MAX_NORMAL_Z, zRef.current + 1);
    if (zRef.current >= MAX_NORMAL_Z) zRef.current = BASE_Z + 1;
    return zRef.current;
  }, []);

  const cascadeOffset = useCallback((windowId: string) => {
    let idx = orderRef.current.indexOf(windowId);
    if (idx < 0) {
      orderRef.current.push(windowId);
      idx = orderRef.current.length - 1;
    }
    const slot = idx % 8;
    return { x: 96 + slot * CASCADE_STEP, y: 80 + slot * CASCADE_STEP };
  }, []);

  const registerWindow = useCallback(
    (entry: { id: string; title: string; subtitle?: string; status: WindowPaneStatus }) => {
      setEntries((prev) => {
        const existing = prev[entry.id];
        // Remounting with open must clear a stale closed/minimized pane entry.
        // Only preserve prior status when the registrant intentionally starts closed.
        const status =
          entry.status === 'open' ? 'open' : (existing?.status ?? entry.status);
        return {
          ...prev,
          [entry.id]: {
            id: entry.id,
            title: entry.title,
            subtitle: entry.subtitle,
            status,
            restoreToken: existing?.restoreToken ?? 0,
            closeToken: existing?.closeToken ?? 0,
            updatedAt: Date.now()
          }
        };
      });
    },
    []
  );

  const updateWindowStatus = useCallback((id: string, status: WindowPaneStatus) => {
    setEntries((prev) => {
      const existing = prev[id];
      if (!existing || existing.status === status) {
        if (!existing) return prev;
        return {
          ...prev,
          [id]: { ...existing, updatedAt: Date.now() }
        };
      }
      return {
        ...prev,
        [id]: { ...existing, status, updatedAt: Date.now() }
      };
    });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    setEntries((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setEntries((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: {
          ...existing,
          status: 'open',
          restoreToken: existing.restoreToken + 1,
          updatedAt: Date.now()
        }
      };
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setEntries((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: {
          ...existing,
          status: 'closed',
          closeToken: (existing.closeToken ?? 0) + 1,
          updatedAt: Date.now()
        }
      };
    });
  }, []);

  const paneEntries = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status === 'minimized' || e.status === 'closed')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'minimized' ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        }),
    [entries]
  );

  const getRestoreToken = useCallback((id: string) => entries[id]?.restoreToken ?? 0, [entries]);
  const getCloseToken = useCallback((id: string) => entries[id]?.closeToken ?? 0, [entries]);

  const value = useMemo(
    () => ({
      claimZIndex,
      cascadeOffset,
      registerWindow,
      updateWindowStatus,
      unregisterWindow,
      restoreWindow,
      closeWindow,
      paneEntries,
      getRestoreToken,
      getCloseToken
    }),
    [
      claimZIndex,
      cascadeOffset,
      registerWindow,
      updateWindowStatus,
      unregisterWindow,
      restoreWindow,
      closeWindow,
      paneEntries,
      getRestoreToken,
      getCloseToken
    ]
  );

  return <WindowStackContext.Provider value={value}>{children}</WindowStackContext.Provider>;
}

export function useWindowStack() {
  const ctx = useContext(WindowStackContext);
  if (!ctx) {
    return {
      claimZIndex: () => BASE_Z + Math.floor(Math.random() * 20),
      cascadeOffset: () => ({ x: 112, y: 88 }),
      registerWindow: () => undefined,
      updateWindowStatus: () => undefined,
      unregisterWindow: () => undefined,
      restoreWindow: () => undefined,
      closeWindow: () => undefined,
      paneEntries: [] as WindowPaneEntry[],
      getRestoreToken: () => 0,
      getCloseToken: () => 0
    };
  }
  return ctx;
}
