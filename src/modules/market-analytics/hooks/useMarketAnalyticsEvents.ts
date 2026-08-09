import { useEffect, useRef, useState } from 'react';
import { marketAnalyticsApi } from '../api/marketAnalyticsApi';

export function useMarketAnalyticsEvents(onEvent?: (evt: unknown) => void) {
  const [connected, setConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    // EventSource cannot set Authorization; use query token only if backend allows — otherwise poll
    const url = `${marketAnalyticsApi.eventsUrl()}?since=${lastSeq}${token ? `&access_token=${encodeURIComponent(token)}` : ''}`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url, { withCredentials: true } as EventSourceInit);
      esRef.current = es;
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
      };
      es.onmessage = (m) => {
        try {
          const data = JSON.parse(m.data);
          if (data.seq) setLastSeq(data.seq);
          onEvent?.(data);
        } catch {
          /* ignore */
        }
      };
    } catch {
      setConnected(false);
    }
    return () => {
      es?.close();
    };
  }, [onEvent, lastSeq]);

  return { connected };
}
