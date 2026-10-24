export type BrokerInstrumentRow = {
  exchange: string;
  segment: string;
  tradingSymbol: string;
  instrumentToken: string;
  underlying: string;
  instrumentType: 'CE' | 'PE' | 'FUT';
  optionType: 'CE' | 'PE' | null;
  strike: number | null;
  expiry: Date;
  lotSize: number;
  freezeQty: number | null;
  tickSize: number | null;
  instrumentKind: 'INDEX' | 'STOCK' | 'COMMODITY';
  name?: string;
  rawMeta?: Record<string, unknown>;
};

export interface BrokerInstrumentAdapter {
  readonly brokerSource: string;
  readonly configured: boolean;
  /** Pull active F&O master rows — never invent hard-coded strike ladders. */
  fetchDerivativeInstruments(): Promise<BrokerInstrumentRow[]>;
}

export class NotConfiguredInstrumentAdapter implements BrokerInstrumentAdapter {
  constructor(
    public readonly brokerSource: string,
    private readonly message = 'not configured'
  ) {}

  get configured() {
    return false;
  }

  async fetchDerivativeInstruments(): Promise<BrokerInstrumentRow[]> {
    throw new Error(`${this.brokerSource} instrument adapter: ${this.message}`);
  }
}
