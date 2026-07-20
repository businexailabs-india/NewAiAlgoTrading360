import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProviderFilters } from '@/api/mcpProviders';

export function ProviderFilterBar({
  filters,
  onChange,
}: {
  filters: ProviderFilters;
  onChange: (next: ProviderFilters) => void;
}) {
  const set = (patch: Partial<ProviderFilters>) => onChange({ ...filters, ...patch });
  return (
    <div
      className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-700/70 bg-zinc-900/40 p-3 md:grid-cols-3 lg:grid-cols-6"
      data-testid="provider-filter-bar"
    >
      <Input
        placeholder="Search providers…"
        value={filters.search || ''}
        onChange={(e) => set({ search: e.target.value })}
        className="bg-zinc-900 border-zinc-700"
      />
      <Select value={filters.country || 'IN'} onValueChange={(v) => set({ country: v })}>
        <SelectTrigger className="bg-zinc-900 border-zinc-700">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="IN">India</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.providerType || 'all'}
        onValueChange={(v) => set({ providerType: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="bg-zinc-900 border-zinc-700">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="broker">Broker</SelectItem>
          <SelectItem value="market_data">Market Data</SelectItem>
          <SelectItem value="exchange">Exchange Data</SelectItem>
          <SelectItem value="paper">Paper Trading</SelectItem>
          <SelectItem value="mock">Mock</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.exchange || 'all'}
        onValueChange={(v) => set({ exchange: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="bg-zinc-900 border-zinc-700">
          <SelectValue placeholder="Exchange" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All exchanges</SelectItem>
          <SelectItem value="NSE">NSE</SelectItem>
          <SelectItem value="BSE">BSE</SelectItem>
          <SelectItem value="MCX">MCX</SelectItem>
          <SelectItem value="NCDEX">NCDEX</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.capability || 'all'}
        onValueChange={(v) => set({ capability: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="bg-zinc-900 border-zinc-700">
          <SelectValue placeholder="Capability" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All capabilities</SelectItem>
          <SelectItem value="orders">Orders</SelectItem>
          <SelectItem value="holdings">Holdings</SelectItem>
          <SelectItem value="positions">Positions</SelectItem>
          <SelectItem value="quotes">Live Quotes</SelectItem>
          <SelectItem value="historical">Historical Data</SelectItem>
          <SelectItem value="option">Options Chain</SelectItem>
          <SelectItem value="paper">Paper Execution</SelectItem>
          <SelectItem value="live">Live Execution</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="bg-zinc-900 border-zinc-700">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="enabled">Enabled</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
          <SelectItem value="placeholder">Placeholder</SelectItem>
          <SelectItem value="connected">Connected</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
