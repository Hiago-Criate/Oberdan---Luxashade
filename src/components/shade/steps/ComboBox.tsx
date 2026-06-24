import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface Props {
  value: string;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  /** Rótulo exibido (e usado na busca). O valor selecionado continua sendo `o`. */
  renderLabel?: (v: string) => string;
}

// Combobox simples: input com filtro + lista cliclável. Usado em listas
// longas (130 cores de tecido, 67 coleções) para evitar dropdown gigante.
export function ComboBox({ value, options, placeholder, disabled, onChange, renderLabel }: Props) {
  const label = (o: string) => (renderLabel ? renderLabel(o) : o);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Sync query quando value muda externamente.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Abre pra cima quando não há espaço suficiente abaixo (footer fixo cobre).
  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Painel: busca (~52px) + lista (até ~224px) + folga p/ footer fixo (~150px).
      setDropUp(spaceBelow < 360);
    }
    setOpen((v) => !v);
  };

  // Fecha ao clicar fora.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => label(o).toLowerCase().includes(q));
  }, [options, query, renderLabel]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'w-full bg-white border border-zinc-200 p-4 rounded-2xl text-left flex items-center justify-between gap-2',
          'focus:outline-none focus:ring-2 focus:ring-zinc-900/5',
          disabled && 'bg-zinc-50 text-zinc-400 cursor-not-allowed',
        )}
      >
        <span className={cn('flex-1 text-left break-words leading-snug text-sm', !value && 'text-zinc-400')}>
          {value ? label(value) : placeholder || 'Selecione…'}
        </span>
        <ChevronDown
          size={18}
          className={cn('text-zinc-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 left-0 right-0 bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-zinc-200/60 overflow-hidden',
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          <div className="relative border-b border-zinc-100">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-10 pr-9 py-3 text-sm focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-zinc-400">Nenhum resultado</div>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors break-words leading-snug',
                  o === value
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-50 text-zinc-700',
                )}
              >
                {label(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
