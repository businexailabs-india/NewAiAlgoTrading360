const KEY = 'smarttrade_paper_baskets_v1';

export type PaperBasketLeg = {
  id: string;
  symbol: string;
  instrumentType: string;
  instrument_type: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  lotSize: number;
  lot_size: number;
  estimatedMargin?: number;
  estimatedRisk?: number;
  /** Take-profit as % of this option's invested premium (e.g. 2). */
  exitPercent?: number;
  entryPremium?: number;
  entrySpot?: number;
  legStatus: string;
  leg_status: string;
};

export type PaperBasket = {
  id: string;
  basket_name: string;
  basketName: string;
  status: string;
  mode: string;
  legs: PaperBasketLeg[];
  legs_count: number;
  /** Take-profit as % of invested option premium (e.g. 2 = 2%). */
  exitPercent?: number;
  /** Take-profit in ₹ on invested / book P&L (e.g. +2000). */
  exitTotal?: number;
};

function nid(p: string) {
  return `${p}-${Math.random().toString(36).slice(2, 9)}`;
}

function load(): PaperBasket[] {
  try {
    const raw = localStorage.getItem(KEY);
    const rows = raw ? (JSON.parse(raw) as PaperBasket[]) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: PaperBasket[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function listPaperBaskets(): PaperBasket[] {
  const rows = load();
  const withLegs = rows.filter((b) => b.legs.length > 0);
  const names = new Set(withLegs.map((b) => b.basket_name.toUpperCase()));
  const emptySeen = new Set<string>();
  const empties: PaperBasket[] = [];
  for (const b of rows) {
    if (b.legs.length) continue;
    const n = b.basket_name.toUpperCase();
    if (names.has(n) || emptySeen.has(n)) continue;
    emptySeen.add(n);
    empties.push(b);
  }
  const next = [...withLegs, ...empties];
  if (next.length !== rows.length) save(next);
  return next;
}

export function getPaperBasket(id: string): PaperBasket | null {
  return load().find((b) => b.id === id) || null;
}

export function createPaperBasket(name: string): PaperBasket {
  const basket: PaperBasket = {
    id: nid('pb'),
    basket_name: name || 'Paper Basket',
    basketName: name || 'Paper Basket',
    status: 'DRAFT',
    mode: 'PAPER',
    legs: [],
    legs_count: 0
  };
  save([basket, ...load()]);
  return basket;
}

export function updatePaperBasket(id: string, name: string): PaperBasket {
  const rows = load();
  const next = rows.map((b) =>
    b.id === id ? { ...b, basket_name: name, basketName: name } : b
  );
  save(next);
  const hit = next.find((b) => b.id === id);
  if (!hit) throw new Error('Basket not found');
  return hit;
}

export function ensurePaperBasket(id: string, name = 'Paper Basket'): PaperBasket {
  const existing = getPaperBasket(id);
  if (existing) return existing;
  const basket: PaperBasket = {
    id,
    basket_name: name,
    basketName: name,
    status: 'DRAFT',
    mode: 'PAPER',
    legs: [],
    legs_count: 0
  };
  save([basket, ...load()]);
  return basket;
}

export function paperLegMargin(args: {
  instrumentType?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  spot: number;
  premium?: number;
}) {
  const type = String(args.instrumentType || '').toUpperCase();
  const qty = Math.max(1, args.quantity);
  const spot = Math.max(1, args.spot);
  if (type.includes('OPTION')) {
    if (args.side === 'BUY') return Math.max(1, Math.round((args.premium || spot * 0.004) * qty));
    return Math.max(1, Math.round(spot * qty * 0.12));
  }
  if (type.includes('FUTURE')) return Math.max(1, Math.round(spot * qty * 0.12));
  return Math.max(1, Math.round(spot * qty * 0.2));
}

function toLeg(leg: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  instrumentType?: string;
  lotSize?: number;
  estimatedMargin?: number;
  estimatedRisk?: number;
}): PaperBasketLeg {
  const type = (leg.instrumentType || 'STOCK').toUpperCase();
  const lot = Math.max(1, leg.lotSize || 1);
  const qty = Math.max(lot, Math.floor(leg.quantity || lot));
  const margin = Math.max(1, Math.round(leg.estimatedMargin || qty * 20));
  return {
    id: nid('leg'),
    symbol: String(leg.symbol || '').toUpperCase(),
    instrumentType: type,
    instrument_type: type,
    side: leg.side,
    quantity: qty,
    lotSize: lot,
    lot_size: lot,
    estimatedMargin: margin,
    estimatedRisk: Math.max(1, Math.round(leg.estimatedRisk || margin * 0.4)),
    legStatus: 'DRAFT',
    leg_status: 'DRAFT'
  };
}

export function addPaperBasketLeg(
  id: string,
  leg: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    instrumentType?: string;
    lotSize?: number;
  }
): PaperBasket {
  return addPaperBasketLegs(id, [leg]);
}

export function addPaperBasketLegs(
  id: string,
  legs: Array<{
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    instrumentType?: string;
    lotSize?: number;
    estimatedMargin?: number;
    estimatedRisk?: number;
  }>
): PaperBasket {
  ensurePaperBasket(id);
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  const seen = new Set(basket.legs.map((l) => l.symbol.toUpperCase()));
  const extra: PaperBasketLeg[] = [];
  for (const leg of legs) {
    const row = toLeg(leg);
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    extra.push(row);
  }
  const nextLegs = [...basket.legs, ...extra];
  const updated = { ...basket, legs: nextLegs, legs_count: nextLegs.length };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function duplicatePaperBasket(id: string): PaperBasket {
  const src = getPaperBasket(id);
  if (!src) throw new Error('Basket not found');
  const copy: PaperBasket = {
    ...src,
    id: nid('pb'),
    basket_name: `${src.basket_name} (copy)`,
    basketName: `${src.basketName} (copy)`,
    status: 'DRAFT',
    legs: src.legs.map((l) => ({ ...l, id: nid('leg') })),
    legs_count: src.legs.length
  };
  save([copy, ...load()]);
  return copy;
}

export function previewPaperBasket(id: string) {
  const b = getPaperBasket(id);
  if (!b) throw new Error('Basket not found');
  const total_estimated_margin = b.legs.reduce((s, l) => s + (l.estimatedMargin || 0), 0);
  const total_risk = b.legs.reduce((s, l) => s + (l.estimatedRisk || 0), 0);
  return {
    allowed: b.legs.length > 0,
    total_estimated_margin,
    total_risk,
    warnings: b.legs.length ? [] : ['Add at least one leg']
  };
}

export function executePaperBasket(
  id: string,
  snapshot?: { premiumOf?: (symbol: string) => number; spot?: number }
): PaperBasket {
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  if (!basket.legs.length) throw new Error('Add at least one leg before executing');
  const updated: PaperBasket = {
    ...basket,
    status: 'EXECUTED',
    legs: basket.legs.map((l) => ({
      ...l,
      entryPremium: snapshot?.premiumOf ? snapshot.premiumOf(l.symbol) : l.entryPremium,
      entrySpot: snapshot?.spot ?? l.entrySpot,
      legStatus: 'FILLED',
      leg_status: 'FILLED'
    }))
  };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function setPaperBasketExit(
  id: string,
  exit: { exitPercent?: number; exitTotal?: number }
): PaperBasket {
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  const updated: PaperBasket = {
    ...basket,
    exitPercent: exit.exitPercent && exit.exitPercent > 0 ? exit.exitPercent : undefined,
    exitTotal: exit.exitTotal && exit.exitTotal > 0 ? exit.exitTotal : undefined
  };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function exitPaperBasket(id: string): PaperBasket {
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  const updated: PaperBasket = {
    ...basket,
    status: 'EXITED',
    legs: basket.legs.map((l) => ({ ...l, legStatus: 'EXITED', leg_status: 'EXITED' }))
  };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function patchPaperBasketLeg(
  id: string,
  legId: string,
  patch: Partial<{
    side: 'BUY' | 'SELL';
    quantity: number;
    estimatedMargin: number;
    estimatedRisk: number;
    exitPercent: number;
  }>
): PaperBasket {
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  const legs = basket.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l));
  const updated = { ...basket, legs, legs_count: legs.length };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function removePaperBasketLeg(id: string, legId: string): PaperBasket {
  const rows = load();
  const basket = rows.find((b) => b.id === id);
  if (!basket) throw new Error('Basket not found');
  const legs = basket.legs.filter((l) => l.id !== legId);
  const updated = { ...basket, legs, legs_count: legs.length };
  save(rows.map((b) => (b.id === id ? updated : b)));
  return updated;
}

export function isLocalPaperBasketId(id: string) {
  return id.startsWith('pb-');
}
