import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

export type AlgosTab = 'home' | 'trading' | 'investing' | 'my' | 'positions' | 'orders';

export const ALGOS_TABS: Array<{ id: AlgosTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'trading', label: 'Trading Algos' },
  { id: 'investing', label: 'Investing Algos' },
  { id: 'my', label: 'My Algos' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' }
];

/** Fixed height of the Algos menu strip under the top bar (tabs + profile). */
export const ALGOS_MENU_H = 52;

interface AlgosNavContextValue {
  tab: AlgosTab;
  setTab: (tab: AlgosTab) => void;
  clearDetail: () => void;
  registerClearDetail: (fn: (() => void) | null) => void;
}

const AlgosNavContext = createContext<AlgosNavContextValue | null>(null);

export function AlgosNavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<AlgosTab>('home');
  const clearRef = useRef<(() => void) | null>(null);

  const registerClearDetail = useCallback((fn: (() => void) | null) => {
    clearRef.current = fn;
  }, []);

  const clearDetail = useCallback(() => {
    clearRef.current?.();
  }, []);

  const setTab = useCallback((next: AlgosTab) => {
    clearRef.current?.();
    setTabState(next);
  }, []);

  const value = useMemo(
    () => ({ tab, setTab, clearDetail, registerClearDetail }),
    [tab, setTab, clearDetail, registerClearDetail]
  );

  return <AlgosNavContext.Provider value={value}>{children}</AlgosNavContext.Provider>;
}

export function useAlgosNav() {
  const ctx = useContext(AlgosNavContext);
  if (!ctx) throw new Error('useAlgosNav must be used within AlgosNavProvider');
  return ctx;
}
