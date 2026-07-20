import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  read_account_profile: true,
  read_margins: true,
  read_holdings: true,
  read_positions: true,
  read_orders: true,
  read_trades: true,
  read_live_quotes: true,
  read_historical_data: true,
  order_preview: true,
  live_order_execution: false,
};

const LABELS: Record<string, string> = {
  read_account_profile: 'Read account profile',
  read_margins: 'Read margins',
  read_holdings: 'Read holdings',
  read_positions: 'Read positions',
  read_orders: 'Read orders',
  read_trades: 'Read trades',
  read_live_quotes: 'Read live quotes',
  read_historical_data: 'Read historical data',
  order_preview: 'Order preview',
  live_order_execution: 'Live order execution (locked)',
};

export function ProviderPermissionSelector({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-3" data-testid="provider-permission-selector">
      {Object.keys(DEFAULT_PERMISSIONS).map((key) => {
        const locked = key === 'live_order_execution';
        return (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2"
          >
            <Label className="flex items-center gap-2 text-sm text-zinc-200">
              {locked && <Lock className="h-3.5 w-3.5 text-rose-300" />}
              {LABELS[key] || key}
            </Label>
            <Switch
              checked={locked ? false : !!value[key]}
              disabled={locked}
              onCheckedChange={(checked) => onChange({ ...value, [key]: checked })}
            />
          </div>
        );
      })}
    </div>
  );
}
