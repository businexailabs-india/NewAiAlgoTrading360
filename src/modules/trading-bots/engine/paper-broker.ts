import type { OrderState, SpreadProposal } from '../types';

export interface BrokerAdapter {
  id: string;
  label: string;
  connected: boolean;
  secretMasked: string;
  submitSpread(spread: SpreadProposal, qty: number): Promise<{ state: OrderState; note: string }>;
}

export class PaperBroker implements BrokerAdapter {
  id = 'paper';
  label = 'PaperBroker';
  connected = true;
  secretMasked = '••••••••';

  async submitSpread(spread: SpreadProposal, qty: number) {
    if (qty <= 0) return { state: 'REJECTED' as const, note: 'Quantity zero after risk sizing.' };
    if (spread.maxLoss <= 0) return { state: 'REJECTED' as const, note: 'Undefined risk — blocked.' };
    await new Promise((r) => setTimeout(r, 40));
    return {
      state: 'FILLED' as const,
      note: `PAPER fill ${spread.type} ${spread.shortStrike}/${spread.longStrike} x${qty} (slippage 0.05, fees applied).`
    };
  }
}

export class StubLiveAdapter implements BrokerAdapter {
  constructor(
    public id: string,
    public label: string,
    public connected: boolean
  ) {}
  secretMasked = '•••• last-4 hidden';
  async submitSpread() {
    return {
      state: 'REJECTED' as const,
      note: 'Live adapter armed only after explicit desk LIVE + connected broker. TradingBots will not submit live legs from this module until multi-leg confirmation is enabled.'
    };
  }
}

export function maskSecret(value: string) {
  if (!value) return '—';
  if (value.length < 8) return '••••';
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
