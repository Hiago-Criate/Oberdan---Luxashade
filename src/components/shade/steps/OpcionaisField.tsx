import { Check } from 'lucide-react';
import { cn } from '../../../utils/cn';
import {
  calcOpcionalPrice,
  type OpcionalRule,
} from '../../../data/sxpOpcionais';

interface Props {
  rules: readonly OpcionalRule[];
  selected: ReadonlySet<string>;
  widthMm: number;
  heightMm: number;
  comandoAlturaMm: number;
  onToggle: (codigo: string) => void;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Lista de opcionais como cards selecionáveis. Cada card mostra descrição,
// observação e o preço já calculado (valor × medida).
export function OpcionaisField({
  rules, selected, widthMm, heightMm, comandoAlturaMm, onToggle,
}: Props) {
  const ctx = { widthMm, heightMm, comandoAlturaMm };

  return (
    <div className="space-y-2.5">
      {rules.map((rule) => {
        const isSelected = selected.has(rule.codigo);
        // Desabilita se algum exclusiveWith estiver marcado.
        const blockedBy = rule.exclusiveWith?.find((c) => selected.has(c)) ?? null;
        const disabled = !!blockedBy && !isSelected;
        const total = calcOpcionalPrice(rule, ctx);
        return (
          <button
            key={rule.codigo}
            type="button"
            onClick={() => !disabled && onToggle(rule.codigo)}
            disabled={disabled}
            className={cn(
              'w-full text-left flex items-start gap-3 px-4 py-3 rounded-2xl border transition-all',
              isSelected
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white border-zinc-200 hover:border-zinc-300',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            <div
              className={cn(
                'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-white border-white' : 'bg-white border-zinc-300',
              )}
            >
              {isSelected && <Check size={14} className="text-zinc-900" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-zinc-800')}>
                {rule.descricao}
              </p>
              {rule.obs && (
                <p className={cn(
                  'text-[11px] mt-0.5 leading-snug',
                  isSelected ? 'text-zinc-300' : 'text-zinc-400',
                )}>
                  {rule.obs}
                </p>
              )}
              {disabled && blockedBy && (
                <p className="text-[11px] text-amber-500 mt-0.5">
                  Incompatível com a opção já marcada.
                </p>
              )}
            </div>
            <div className={cn(
              'text-sm font-semibold whitespace-nowrap',
              isSelected ? 'text-white' : 'text-zinc-700',
            )}>
              {rule.formula === 'fixo' && rule.valor === 0
                ? 'Grátis'
                : `R$ ${fmtBRL(total)}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
