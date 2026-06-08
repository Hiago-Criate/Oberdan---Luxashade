import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { TrilhoOrderFlow } from './trilho/TrilhoOrderFlow';
import { ShadeOrderFlow } from './shade/ShadeOrderFlow';
import { EmissorOrderFlow } from './emissor/EmissorOrderFlow';
import { SelectField } from './shade/steps/SelectField';
import { StepShell } from './shade/steps/StepShell';
import {
  BRAND_LABEL,
  familiesForBrand,
  familyDisplay,
  TRILHO_OPT,
  EMISSOR_OPT,
  type Brand,
} from '../data/brands';
import type { OrderItem } from '../types/order';

interface Props {
  brand: Brand;
  initialItem?: OrderItem | null;
  onSave: (item: OrderItem) => void;
  onBack: () => void;
}

// Wrapper único: a primeira pergunta é "Categoria", restrita às famílias
// da marca selecionada. Conforme a escolha, mostra o sub-fluxo apropriado.
export function OrderFlow({ brand, initialItem, onSave, onBack }: Props) {
  const familiasMarca = familiesForBrand(brand);

  const [categoria, setCategoria] = useState<string>(
    initialItem
      ? initialItem.kind === 'trilho'
        ? TRILHO_OPT
        : initialItem.kind === 'emissor'
        ? EMISSOR_OPT
        : initialItem.familia
      : '',
  );

  // Reset do subfluxo quando muda a categoria (key força remount).
  const subKey = `${categoria}-${initialItem?.id ?? 'new'}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="pt-8 pb-40 space-y-7"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <img
            src={brand === 'shadexp' ? '/logo-shadexp.png' : '/logo-luxashade.png'}
            alt={BRAND_LABEL[brand]}
            className="h-16 object-contain object-left mb-1"
          />
          <h2 className="text-xl font-medium">Configurar Item</h2>
        </div>
      </div>

      <StepShell label="Categoria">
        <SelectField
          value={categoria}
          options={familiasMarca}
          placeholder="Escolha a categoria"
          onChange={(v) => setCategoria(v)}
          renderLabel={(v) => familyDisplay(v)}
        />
      </StepShell>

      {categoria === TRILHO_OPT && (
        <TrilhoOrderFlow
          key={subKey}
          brand={brand}
          initialItem={initialItem?.kind === 'trilho' ? initialItem : null}
          onSave={onSave}
        />
      )}

      {categoria === EMISSOR_OPT && (
        <EmissorOrderFlow
          key={subKey}
          brand={brand}
          initialItem={initialItem?.kind === 'emissor' ? initialItem : null}
          onSave={onSave}
        />
      )}

      {categoria && categoria !== TRILHO_OPT && categoria !== EMISSOR_OPT && (
        <ShadeOrderFlow
          key={subKey}
          brand={brand}
          familia={categoria}
          initialItem={
            initialItem?.kind === 'shade' && initialItem.familia === categoria
              ? initialItem
              : null
          }
          onSave={onSave}
        />
      )}
    </motion.div>
  );
}
