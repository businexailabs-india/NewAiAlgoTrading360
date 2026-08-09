import { MaConfig } from '../config';
import { BrokerAdapter } from './BrokerAdapter';
import { SimulatedBrokerAdapter } from './SimulatedBrokerAdapter';
import { IBKRPaperAdapter } from './IBKRPaperAdapter';

export function createBrokerAdapter(cfg: MaConfig, kind: 'SIMULATED' | 'IBKR_PAPER' = 'SIMULATED'): BrokerAdapter {
  if (kind === 'IBKR_PAPER') return new IBKRPaperAdapter(cfg);
  return new SimulatedBrokerAdapter({ netLiq: cfg.startingEquity });
}
