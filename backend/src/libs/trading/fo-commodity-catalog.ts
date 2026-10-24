/**
 * MCX commodity F&O underlyings (FUTCOM / OPTFUT / OPTCOM).
 * Lots & strike steps follow typical MCX contract specs — refresh after exchange circulars.
 * Dhan optionchain uses UnderlyingSeg MCX_COMM; scrip ids are filled when known (0 = paper/master).
 */

export type FoCommodityMeta = {
  symbol: string;
  name: string;
  aliases: string[];
  exchange: 'MCX';
  dhanScripId: number;
  lot: number;
  step: number;
  tick: number;
  hasDerivatives: boolean;
};

export const FO_COMMODITY_CATALOG: FoCommodityMeta[] = [
  {
    symbol: 'GOLD',
    name: 'Gold 1 kg',
    aliases: ['GOLD', 'GOLD 1KG'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 100,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'GOLDM',
    name: 'Gold Mini 100 g',
    aliases: ['GOLDM', 'GOLD MINI', 'GOLDMINI'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 100,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'GOLDGUINEA',
    name: 'Gold Guinea 8 g',
    aliases: ['GOLDGUINEA', 'GOLD GUINEA'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 100,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'GOLDPETAL',
    name: 'Gold Petal 1 g',
    aliases: ['GOLDPETAL', 'GOLD PETAL'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 50,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'SILVER',
    name: 'Silver 30 kg',
    aliases: ['SILVER'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 250,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'SILVERM',
    name: 'Silver Mini 5 kg',
    aliases: ['SILVERM', 'SILVER MINI', 'SILVERMINI'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 250,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'SILVERMIC',
    name: 'Silver Micro 1 kg',
    aliases: ['SILVERMIC', 'SILVER MICRO'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 250,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'CRUDEOIL',
    name: 'Crude Oil',
    aliases: ['CRUDEOIL', 'CRUDE', 'CRUDE OIL'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 50,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'CRUDEOILM',
    name: 'Crude Oil Mini',
    aliases: ['CRUDEOILM', 'CRUDE MINI', 'CRUDEOIL MINI'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 50,
    tick: 1,
    hasDerivatives: true
  },
  {
    symbol: 'NATURALGAS',
    name: 'Natural Gas',
    aliases: ['NATURALGAS', 'NATGAS', 'NATURAL GAS', 'NG'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 5,
    tick: 0.1,
    hasDerivatives: true
  },
  {
    symbol: 'NATGASMINI',
    name: 'Natural Gas Mini',
    aliases: ['NATGASMINI', 'NATURALGAS MINI', 'NG MINI'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 5,
    tick: 0.1,
    hasDerivatives: true
  },
  {
    symbol: 'COPPER',
    name: 'Copper',
    aliases: ['COPPER'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 5,
    tick: 0.05,
    hasDerivatives: true
  },
  {
    symbol: 'ZINC',
    name: 'Zinc',
    aliases: ['ZINC'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 5,
    tick: 0.05,
    hasDerivatives: true
  },
  {
    symbol: 'ALUMINIUM',
    name: 'Aluminium',
    aliases: ['ALUMINIUM', 'ALUMINUM', 'ALUMINIUMM'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 1,
    tick: 0.05,
    hasDerivatives: true
  },
  {
    symbol: 'LEAD',
    name: 'Lead',
    aliases: ['LEAD'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 1,
    tick: 0.05,
    hasDerivatives: true
  },
  {
    symbol: 'NICKEL',
    name: 'Nickel',
    aliases: ['NICKEL'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 10,
    tick: 0.1,
    hasDerivatives: true
  },
  {
    symbol: 'COTTON',
    name: 'Cotton',
    aliases: ['COTTON'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 100,
    tick: 10,
    hasDerivatives: true
  },
  {
    symbol: 'MENTHAOIL',
    name: 'Mentha Oil',
    aliases: ['MENTHAOIL', 'MENTHA', 'MENTHA OIL'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 10,
    tick: 0.1,
    hasDerivatives: true
  },
  {
    symbol: 'CPO',
    name: 'Crude Palm Oil',
    aliases: ['CPO', 'PALM OIL', 'CRUDE PALM'],
    exchange: 'MCX',
    dhanScripId: 0,
    lot: 1,
    step: 10,
    tick: 0.1,
    hasDerivatives: true
  }
];

const BY_SYMBOL = new Map(FO_COMMODITY_CATALOG.map((x) => [x.symbol, x]));

export function getFoCommodity(symbol: string): FoCommodityMeta | undefined {
  const key = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (BY_SYMBOL.has(key)) return BY_SYMBOL.get(key);
  return FO_COMMODITY_CATALOG.find(
    (x) =>
      x.symbol === key ||
      x.aliases.some((a) => a.replace(/\s+/g, '').toUpperCase() === key)
  );
}

export function foCommodityUnderlyings(): FoCommodityMeta[] {
  return FO_COMMODITY_CATALOG.filter((x) => x.hasDerivatives);
}

export function isCommodityFoUnderlying(symbol: string): boolean {
  return Boolean(getFoCommodity(symbol)?.hasDerivatives);
}
