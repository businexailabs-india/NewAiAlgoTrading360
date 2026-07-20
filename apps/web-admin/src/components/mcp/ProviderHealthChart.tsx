import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function ProviderHealthChart({
  points,
}: {
  points: Array<{ time: string; latency: number; failures: number }>;
}) {
  const data =
    points.length > 0
      ? points
      : [
          { time: 'now', latency: 0, failures: 0 },
        ];
  return (
    <div className="h-56 rounded-xl border border-zinc-700/70 bg-zinc-900/40 p-3" data-testid="provider-health-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="time" stroke="#888" fontSize={10} />
          <YAxis stroke="#888" fontSize={10} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
          />
          <Line type="monotone" dataKey="latency" stroke="#22d3ee" strokeWidth={2} name="Latency ms" />
          <Line type="monotone" dataKey="failures" stroke="#f43f5e" strokeWidth={2} name="Failures" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
