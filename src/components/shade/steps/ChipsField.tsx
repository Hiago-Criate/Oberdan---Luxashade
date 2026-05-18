import { cn } from '../../../utils/cn';

interface Props {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (v: string) => void;
  /** Função opcional para customizar o label exibido em cada chip. */
  renderLabel?: (opt: string) => string;
  /** Grid: 'auto' ajusta às opções; 'cols-3' fixa 3 colunas etc. */
  cols?: 2 | 3 | 4;
}

// Botões tipo "chip" para listas curtas (Tipo, Cor Acabamento).
export function ChipsField({ value, options, disabled, onChange, renderLabel, cols = 3 }: Props) {
  const gridCls = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className={cn('grid gap-2', gridCls)}>
      {options.map((o) => {
        const selected = value === o;
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o)}
            className={cn(
              'py-3 px-3 text-[11px] uppercase tracking-tight rounded-xl border transition-all text-center leading-tight',
              selected
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {renderLabel ? renderLabel(o) : o}
          </button>
        );
      })}
    </div>
  );
}
