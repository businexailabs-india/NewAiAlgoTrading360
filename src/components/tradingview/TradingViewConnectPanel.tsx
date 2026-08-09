import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { API_BASE_URL } from '@/lib/api';

type Conn = {
  id: string;
  name: string;
  webhookUrl?: string;
  secretHint: string;
  defaultMode: string;
  isActive: boolean;
};

type Signal = {
  id: string;
  symbol: string;
  side: string;
  signalType: string;
  status: string;
  price?: number;
  quantity: number;
  createdAt: string;
};

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(56,189,248,0.35)',
  background: 'rgba(15,23,42,0.88)',
  padding: 16,
  color: '#e2e8f0'
};

const btn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(56,189,248,0.4)',
  background: 'rgba(14,165,233,0.15)',
  color: '#7dd3fc',
  cursor: 'pointer',
  fontSize: 12
};

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function TradingViewConnectPanel() {
  const [tab, setTab] = useState<'connect' | 'inbox' | 'guide' | 'payloads'>('connect');
  const [connections, setConnections] = useState<Conn[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [created, setCreated] = useState<{ secret?: string; webhookUrl?: string; samplePayload?: unknown } | null>(
    null
  );
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [secretForTest, setSecretForTest] = useState('');
  const [payloadKind, setPayloadKind] = useState('BUY');
  const [payloadPreview, setPayloadPreview] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, s] = await Promise.all([
        fetch(`${API_BASE_URL}/tradingview/connections`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/signals`, { headers: headers() }).then((r) => r.json())
      ]);
      setConnections(c.data || []);
      setSignals(s.data || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createConn = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/tradingview/connections`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: 'TradingView Connect' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Create failed');
      setCreated({
        secret: json.data.secret,
        webhookUrl: json.data.webhookUrl,
        samplePayload: json.data.samplePayload
      });
      setSecretForTest(json.data.secret || '');
      setPayloadPreview(JSON.stringify(json.data.samplePayload, null, 2));
      await load();
      setMsg('Connection created — copy the secret now (shown once).');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const testWebhook = async (id: string) => {
    if (!secretForTest) {
      setMsg('Paste webhook secret to send a test alert');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tradingview/webhook/${id}/test`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          secret: secretForTest,
          symbol: 'RELIANCE',
          side: 'BUY',
          signal_type: 'VWAP_BREAKOUT',
          price: 1400,
          quantity: 1,
          timestamp: new Date().toISOString()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Test failed');
      setMsg(`Test OK — signal ${json.data?.signal?.id?.slice(0, 8)}…`);
      await load();
      setTab('inbox');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setBusy(false);
    }
  };

  const act = async (signalId: string, action: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/signals/${signalId}/${action}`, {
        method: 'POST',
        headers: headers(),
        body: '{}'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || action + ' failed');
      setMsg(`${action}: ${json.data?.status || json.data?.message || 'ok'}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const genPayload = async () => {
    const res = await fetch(`${API_BASE_URL}/tradingview/payload-builder/generate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ kind: payloadKind, secret: secretForTest || 'USER_WEBHOOK_SECRET' })
    });
    const json = await res.json();
    setPayloadPreview(JSON.stringify(json.data, null, 2));
  };

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#7dd3fc' }}>TradingView Connect</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Convert TradingView alerts into safe, paper-tested, risk-controlled algo workflows
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['connect', 'inbox', 'payloads', 'guide'] as const).map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...btn, opacity: tab === t ? 1 : 0.7 }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {msg ? <div style={{ marginTop: 12, fontSize: 13, color: '#fde68a' }}>{msg}</div> : null}

      {tab === 'connect' && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <button type="button" style={btn} disabled={busy} onClick={() => void createConn()}>
            Create webhook connection
          </button>
          {created?.webhookUrl ? (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(2,6,23,0.7)', fontSize: 13 }}>
              <div>
                <b>Webhook URL</b>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#a5f3fc' }}>{created.webhookUrl}</pre>
              </div>
              <div>
                <b>Secret (copy once)</b>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#fda4af' }}>{created.secret}</pre>
              </div>
            </div>
          ) : null}
          <label style={{ fontSize: 12, color: '#94a3b8' }}>
            Secret for test alerts
            <input
              value={secretForTest}
              onChange={(e) => setSecretForTest(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: '1px solid #334155',
                background: '#020617',
                color: '#e2e8f0'
              }}
            />
          </label>
          {connections.map((c) => (
            <div
              key={c.id}
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  …{c.secretHint} · {c.defaultMode} · {c.webhookUrl}
                </div>
              </div>
              <button type="button" style={btn} disabled={busy} onClick={() => void testWebhook(c.id)}>
                Send test alert
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'inbox' && (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {signals.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No signals yet — create a connection and send a test alert.</div>
          ) : (
            signals.map((s) => (
              <div key={s.id} style={{ padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ fontWeight: 600 }}>
                  {s.side} {s.symbol} · {s.signalType}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {s.status} · qty {s.quantity} · {new Date(s.createdAt).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={btn} onClick={() => void act(s.id, 'validate')}>
                    Validate
                  </button>
                  <button type="button" style={btn} onClick={() => void act(s.id, 'paper-test')}>
                    Paper test
                  </button>
                  <button type="button" style={btn} onClick={() => void act(s.id, 'convert-to-strategy')}>
                    Convert to strategy
                  </button>
                  <button type="button" style={btn} onClick={() => void act(s.id, 'request-live-approval')}>
                    Request live
                  </button>
                  <button type="button" style={btn} onClick={() => void act(s.id, 'ignore')}>
                    Ignore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'payloads' && (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={payloadKind}
              onChange={(e) => setPayloadKind(e.target.value)}
              style={{ padding: 8, borderRadius: 8, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
            >
              {['BUY', 'SELL', 'EXIT', 'STOP_LOSS', 'OPTIONS', 'MULTI_ACCOUNT', 'STANDARD'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button type="button" style={btn} onClick={() => void genPayload()}>
              Generate payload
            </button>
          </div>
          <pre style={{ padding: 12, borderRadius: 8, background: '#020617', overflow: 'auto', fontSize: 12 }}>
            {payloadPreview || 'Generate a payload to paste into TradingView alert message.'}
          </pre>
        </div>
      )}

      {tab === 'guide' && (
        <ol style={{ marginTop: 16, paddingLeft: 20, color: '#cbd5e1', lineHeight: 1.7, fontSize: 14 }}>
          <li>Open TradingView chart.</li>
          <li>Add indicator or strategy.</li>
          <li>Create alert.</li>
          <li>Select webhook URL.</li>
          <li>Paste BusineXAi webhook URL from Connect tab.</li>
          <li>Paste JSON payload from Payloads tab.</li>
          <li>Save alert.</li>
          <li>Send test signal.</li>
          <li>Run paper mode first — live stays locked by default.</li>
        </ol>
      )}
    </div>
  );
}
