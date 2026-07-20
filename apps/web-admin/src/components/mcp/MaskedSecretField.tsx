import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { maskSecret } from '@/api/mcpProviders';

/** Displays a masked secret; never reveals raw value after save (display-only). */
export function MaskedSecretField({
  label,
  value,
  revealable = false,
}: {
  label: string;
  value: string;
  /** Only true while typing in wizard before submit — never for stored secrets */
  revealable?: boolean;
}) {
  const [show, setShow] = useState(false);
  const display = revealable && show ? value : maskSecret(value || '****');
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={display}
          className="bg-zinc-900/60 border-zinc-700 font-mono text-sm"
          data-testid="masked-secret-field"
        />
        {revealable && value && (
          <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
