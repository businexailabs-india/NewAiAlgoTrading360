/**
 * Catalog of Indian broker / trading MCP server presets.
 * Endpoints can be overridden via env: MCP_<PROVIDER>_URL (e.g. MCP_DHAN_URL).
 */

export type IndianMcpPreset = {
  provider: string;
  name: string;
  transport: 'HTTP' | 'SSE';
  /** Default local/dev endpoint when env override is absent */
  defaultEndpoint: string;
  region: 'IN';
  category: 'broker' | 'aggregate';
  docsUrl?: string;
  notes?: string;
};

const PRESETS: IndianMcpPreset[] = [
  {
    provider: 'dhan',
    name: 'Dhan MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3101/mcp',
    region: 'IN',
    category: 'broker',
    docsUrl: 'https://dhanhq.co/',
    notes: 'Preferred MCP for this app (portfolio, orders, market).'
  },
  {
    provider: 'zerodha',
    name: 'Zerodha (Kite) MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3102/mcp',
    region: 'IN',
    category: 'broker',
    docsUrl: 'https://kite.trade/',
    notes: 'Kite Connect via MCP bridge.'
  },
  {
    provider: 'angelone',
    name: 'Angel One MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3103/mcp',
    region: 'IN',
    category: 'broker',
    docsUrl: 'https://smartapi.angelbroking.com/',
    notes: 'SmartAPI MCP bridge.'
  },
  {
    provider: 'upstox',
    name: 'Upstox MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3104/mcp',
    region: 'IN',
    category: 'broker',
    docsUrl: 'https://upstox.com/developer/',
    notes: 'Upstox API MCP bridge.'
  },
  {
    provider: 'groww',
    name: 'Groww MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3105/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'Groww trading MCP bridge (when available).'
  },
  {
    provider: '5paisa',
    name: '5Paisa MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3106/mcp',
    region: 'IN',
    category: 'broker',
    notes: '5Paisa OpenAPI MCP bridge.'
  },
  {
    provider: 'iifl',
    name: 'IIFL Securities MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3107/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'IIFL Markets MCP bridge.'
  },
  {
    provider: 'motilal',
    name: 'Motilal Oswal MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3108/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'MO Investor / OpenAPI MCP bridge.'
  },
  {
    provider: 'fyers',
    name: 'Fyers MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3109/mcp',
    region: 'IN',
    category: 'broker',
    docsUrl: 'https://myapi.fyers.in/',
    notes: 'Fyers API MCP bridge.'
  },
  {
    provider: 'aliceblue',
    name: 'Alice Blue MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3110/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'Alice Blue ANT MCP bridge.'
  },
  {
    provider: 'kotak',
    name: 'Kotak Neo MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3111/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'Kotak Neo API MCP bridge.'
  },
  {
    provider: 'paytm_money',
    name: 'Paytm Money MCP',
    transport: 'HTTP',
    defaultEndpoint: 'http://localhost:3112/mcp',
    region: 'IN',
    category: 'broker',
    notes: 'Paytm Money trading MCP bridge.'
  }
];

function envKeyForProvider(provider: string): string {
  return `MCP_${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL`;
}

export function resolveIndianMcpEndpoint(preset: IndianMcpPreset): string {
  const fromEnv = process.env[envKeyForProvider(preset.provider)]?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Shared fallback used by docker-compose / local dhan MCP
  if (preset.provider === 'dhan') {
    const dhan =
      process.env.DHAN_MCP_URL?.trim() ||
      process.env.MCP_DHAN_ENDPOINT?.trim() ||
      process.env.USER_DHAN_MCP_URL?.trim();
    if (dhan) return dhan.replace(/\/$/, '');
  }
  return preset.defaultEndpoint.replace(/\/$/, '');
}

export function listIndianMcpPresets() {
  return PRESETS.map((p) => ({
    ...p,
    endpoint: resolveIndianMcpEndpoint(p),
    envKey: envKeyForProvider(p.provider),
    endpointFromEnv: Boolean(process.env[envKeyForProvider(p.provider)]?.trim())
  }));
}

export type ResolvedIndianMcpPreset = ReturnType<typeof listIndianMcpPresets>[number];
