import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isSensitiveCredentialKey } from '@/api/mcpProviders';

export function CredentialInput({
  name,
  label,
  value,
  onChange,
  required,
  sensitive,
}: {
  name: string;
  label?: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  sensitive?: boolean;
}) {
  const isSecret = sensitive ?? isSensitiveCredentialKey(name);
  const pretty = label || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="space-y-1.5" data-testid={`credential-input-${name}`}>
      <Label htmlFor={name} className="text-zinc-300">
        {pretty}
        {required ? <span className="text-rose-400"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={isSecret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="bg-zinc-900/70 border-zinc-700 text-white"
        placeholder={isSecret ? '••••••••' : `Enter ${pretty}`}
      />
    </div>
  );
}
