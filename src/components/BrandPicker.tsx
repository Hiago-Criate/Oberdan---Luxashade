import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Brand } from '../data/brands';
import { brandTagline, familiesForBrand, familyDisplay } from '../data/brands';
import { cn } from '../utils/cn';

interface Props {
  onSelect: (brand: Brand) => void;
  onBack: () => void;
}

interface CardProps {
  brand: Brand;
  title: string;
  onClick: () => void;
}

function BrandCard({ brand, title, onClick }: CardProps) {
  const families = familiesForBrand(brand);
  // Preview das primeiras 4 famílias (com nome legível). Mostra "..." se sobrar.
  const preview = families.slice(0, 4).map((f) => familyDisplay(f));
  const more = families.length - preview.length;

  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-shadow',
        'flex items-center justify-between gap-4',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="mb-3">
          <img
            src={brand === 'shadexp' ? '/logo-shadexp.png' : '/logo-luxashade.png'}
            alt={title}
            className="h-32 object-contain object-left"
          />
        </div>
        <p className="text-xs text-zinc-400 mb-3">{brandTagline(brand)}</p>
        <div className="flex flex-wrap gap-1.5">
          {preview.map((p) => (
            <span
              key={p}
              className="text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 rounded-full px-2.5 py-1"
            >
              {p}
            </span>
          ))}
          {more > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 px-1.5 py-1">
              +{more}
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={22} className="text-zinc-400 flex-shrink-0" />
    </motion.button>
  );
}

export function BrandPicker({ onSelect, onBack }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col pt-16 pb-12 space-y-10"
    >
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-light tracking-tight">Selecione a marca</h1>
        <p className="text-sm text-zinc-500">
          Cada marca exibe suas próprias famílias de cortinas
        </p>
      </div>

      <div className="space-y-4">
        <BrandCard brand="luxashade" title="Luxashade" onClick={() => onSelect('luxashade')} />
        <BrandCard brand="shadexp" title="ShadeXP" onClick={() => onSelect('shadexp')} />
      </div>

      <div className="flex-1" />

      <button
        onClick={onBack}
        className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors mx-auto"
      >
        ← Voltar
      </button>
    </motion.div>
  );
}
