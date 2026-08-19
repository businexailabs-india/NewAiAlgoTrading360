import { MaConfig } from '../config';
import { BrokerAdapter } from './BrokerAdapter';
import { SimulatedBrokerAdapter } from './SimulatedBrokerAdapter';

/** India paper sim only — US/IBKR adapters removed from the platform. */
export function createBrokerAdapter(cfg: MaConfig, _kind: 'SIMULATED' | 'IBKR_PAPER' = 'SIMULATED'): BrokerAdapter {
  return new SimulatedBrokerAdapter({ netLiq: cfg.startingEquity });
}
