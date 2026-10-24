/** TradeOS360 design tokens — follow html.light / html.dark CSS variables */
export const tradeos = {
  navy: 'var(--to-navy)',
  navySoft: 'var(--to-navy-soft)',
  card: 'var(--to-card)',
  cardBorder: 'var(--to-card-border)',
  text: 'var(--to-text)',
  muted: 'var(--to-muted)',
  teal: '#2DD4BF',
  blue: '#38BDF8',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  grey: '#64748B',
  radius: 16,
  shadow: 'var(--to-shadow)'
} as const;

export type StatusTone = 'safe' | 'warning' | 'blocked' | 'info' | 'locked';

export const toneColor: Record<StatusTone, string> = {
  safe: tradeos.green,
  warning: tradeos.amber,
  blocked: tradeos.red,
  info: tradeos.blue,
  locked: tradeos.grey
};
