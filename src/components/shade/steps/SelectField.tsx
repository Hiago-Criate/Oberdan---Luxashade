import { ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  renderLabel?: (v: string) => string;
}

// Dropdown nativo estilizado, idêntico ao padrão visual já usado no trilho.
export function SelectField({ value, options, placeholder, disabled, onChange, renderLabel }: Props) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        <option value="" disabled>
          {placeholder ?? 'Selecione…'}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderLabel ? renderLabel(o) : o}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        size={18}
      />
    </div>
  );
}
