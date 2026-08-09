/** TradeOS360 design tokens — Apple-calm, bank-safe */
export const tradeos = {
  navy: '#0B1220',
  navySoft: '#121A2B',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(148,163,184,0.18)',
  text: '#F8FAFC',
  muted: '#94A3B8',
  teal: '#2DD4BF',
  blue: '#38BDF8',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  grey: '#64748B',
  radius: 16,
  shadow: '0 8px 32px rgba(0,0,0,0.28)'
} as const;

export type StatusTone = 'safe' | 'warning' | 'blocked' | 'info' | 'locked';

export const toneColor: Record<StatusTone, string> = {
  safe: tradeos.green,
  warning: tradeos.amber,
  blocked: tradeos.red,
  info: tradeos.blue,
  locked: tradeos.grey
};
