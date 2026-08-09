import type { CSSProperties } from 'react';

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px dashed rgba(148,163,184,0.4)',
  background: 'rgba(15,23,42,0.7)',
  padding: 20,
  color: '#cbd5e1'
};

/** Optional advanced module — not required for mass-market TradingView workflow */
export function QuantLabPlaceholder() {
  return (
    <div style={panel}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#a5b4fc' }}>Quant Lab (Optional)</div>
      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
        Advanced users can connect QuantConnect / LEAN for Python or C# backtesting and optimization.
      </p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        TradingView Connect is the primary path for most users. Quant Lab is optional and never required to
        paper-test or deploy alert-driven strategies.
      </p>
    </div>
  );
}
