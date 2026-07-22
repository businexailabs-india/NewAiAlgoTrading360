import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from './AuthContext';

export type TradingMode = 'paper' | 'live';

export type BrokerStatusPayload = {
  hasConnectedBroker: boolean;
  liveTradingEnabled: boolean;
  featureLiveOptions: boolean;
  killSwitch: boolean;
  approvalState: string;
  connections: Array<{
    id: string;
    broker: string;
    displayName: string | null;
    status: string;
    tokenExpired: boolean;
  }>;
};

type ModeState = {
  mode: TradingMode;
  hasTradingPin: boolean;
  liveLocked: boolean;
  liveEnabled: boolean;
  cooldownUntil: string | null;
  brokers: BrokerStatusPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchMode: (args: {
    mode: TradingMode;
    pin: string;
    confirmLive?: boolean;
  }) => Promise<void>;
  setTradingPin: (pin: string, currentPin?: string) => Promise<void>;
};

const TradingModeContext = createContext<ModeState | null>(null);

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function TradingModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<TradingMode>('paper');
  const [hasTradingPin, setHasTradingPin] = useState(false);
  const [liveLocked, setLiveLocked] = useState(true);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<BrokerStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMode('paper');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/mode`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to load trading mode');
      const d = json.data;
      setMode(d.mode === 'live' ? 'live' : 'paper');
      setHasTradingPin(!!d.hasTradingPin);
      setLiveLocked(!!d.liveLocked);
      setLiveEnabled(!!d.liveEnabled);
      setCooldownUntil(d.cooldownUntil || null);
      setBrokers(d.brokers || null);
    } catch {
      setMode('paper');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchMode = useCallback(
    async (args: { mode: TradingMode; pin: string; confirmLive?: boolean }) => {
      const res = await fetch(`${API_BASE_URL}/mode/switch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(args),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Mode switch failed');
      const d = json.data;
      setMode(d.mode === 'live' ? 'live' : 'paper');
      setHasTradingPin(!!d.hasTradingPin);
      setLiveLocked(!!d.liveLocked);
      setLiveEnabled(!!d.liveEnabled);
      setCooldownUntil(d.cooldownUntil || null);
      setBrokers(d.brokers || null);
    },
    []
  );

  const setTradingPin = useCallback(async (pin: string, currentPin?: string) => {
    const res = await fetch(`${API_BASE_URL}/mode/pin`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ pin, currentPin }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Failed to set Trading PIN');
    setHasTradingPin(true);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      hasTradingPin,
      liveLocked,
      liveEnabled,
      cooldownUntil,
      brokers,
      loading,
      refresh,
      switchMode,
      setTradingPin,
    }),
    [
      mode,
      hasTradingPin,
      liveLocked,
      liveEnabled,
      cooldownUntil,
      brokers,
      loading,
      refresh,
      switchMode,
      setTradingPin,
    ]
  );

  return <TradingModeContext.Provider value={value}>{children}</TradingModeContext.Provider>;
}

export function useTradingMode() {
  const ctx = useContext(TradingModeContext);
  if (!ctx) throw new Error('useTradingMode must be used within TradingModeProvider');
  return ctx;
}
