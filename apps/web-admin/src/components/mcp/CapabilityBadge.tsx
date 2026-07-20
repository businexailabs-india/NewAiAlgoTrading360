import { Badge } from '@/components/ui/badge';

export function CapabilityBadge({ capability }: { capability: string }) {
  return (
    <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-200/90 bg-cyan-500/5">
      {capability.replace(/_/g, ' ')}
    </Badge>
  );
}
