import { useState } from 'react';
import { motion } from 'motion/react';
import { ChipsField } from '../shade/steps/ChipsField';
import { SelectField } from '../shade/steps/SelectField';
import { StepShell } from '../shade/steps/StepShell';
import { cn } from '../../utils/cn';
import { BRAND_LABEL, type Brand } from '../../data/brands';
import { MOTOR_BRANDS, emissoresFor, type MotorBrand } from '../../data/emissores';
import type { EmissorItem } from '../../types/order';

interface Props {
  brand: Brand;
  initialItem?: EmissorItem | null;
  onSave: (item: EmissorItem) => void;
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// Fluxo do item "EMISSORES": marca do motor → emissor disponível → quantidade →
// observação (em qual canal cada peça é programada) → valor.
export function EmissorOrderFlow({ brand, initialItem, onSave }: Props) {
  const [ambiente, setAmbiente] = useState(initialItem?.ambiente ?? '');
  const [motorBrand, setMotorBrand] = useState<MotorBrand | ''>(initialItem?.motorBrand ?? '');
  const [codigo, setCodigo] = useState(initialItem?.codigo ?? '');
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [observacao, setObservacao] = useState(initialItem?.observacao ?? '');

  const emissores = motorBrand ? emissoresFor(brand, motorBrand) : [];
  const selected = emissores.find((e) => e.codigo === codigo) ?? null;
  const valorUnit = selected?.valor ?? 0;
  const price = valorUnit * quantity;
  const canAdd = !!motorBrand && !!selected;

  const handleAdd = () => {
    if (!selected || !motorBrand) return;
    onSave({
      kind: 'emissor',
      id: initialItem?.id ?? Math.random().toString(36).slice(2, 11),
      brand,
      productCategory: 'Emissor',
      ambiente: ambiente.trim(),
      motorBrand,
      codigo: selected.codigo,
      descricao: selected.descricao,
      canais: selected.canais,
      quantity,
      valorUnit: selected.valor,
      observacao: observacao.trim() || undefined,
      price,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs text-zinc-500 leading-relaxed">
        Para motores de radiofrequência, sugerimos incluir um emissor —{' '}
        <strong className="text-zinc-700">1 canal para cada motor</strong>. Não é obrigatório.
      </div>

      <StepShell label="Ambiente">
        <input
          type="text"
          placeholder="Ex: Sala de Estar"
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value)}
          className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
        />
      </StepShell>

      <StepShell label="Marca do Motor">
        <ChipsField
          value={motorBrand}
          options={MOTOR_BRANDS}
          cols={2}
          onChange={(v) => {
            setMotorBrand(v as MotorBrand);
            setCodigo('');
          }}
        />
      </StepShell>

      {motorBrand &&
        (emissores.length > 0 ? (
          <StepShell label="Emissor / Controle">
            <SelectField
              value={codigo}
              options={emissores.map((e) => e.codigo)}
              placeholder="Escolha o emissor"
              onChange={(v) => setCodigo(v)}
              renderLabel={(c) => {
                const e = emissores.find((x) => x.codigo === c);
                return e ? `${e.descricao} — R$ ${fmtBRL(e.valor)}` : c;
              }}
            />
          </StepShell>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 leading-relaxed">
            Nenhum emissor {motorBrand} cadastrado para {BRAND_LABEL[brand]} ainda. Fale com o
            vendedor para incluir o controle correto.
          </div>
        ))}

      {selected && (
        <StepShell label="Quantidade">
          <div className="flex items-center justify-between bg-white border border-zinc-200 p-2 rounded-2xl">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
            >
              -
            </button>
            <span className="text-lg font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
            >
              +
            </button>
          </div>
        </StepShell>
      )}

      {selected && (
        <StepShell
          label="Observação (canal de cada item)"
          hint='Identifique em qual canal cada item será programado. Ex: "Item 01 → canal 3; Item 02 → canal 1".'
        >
          <textarea
            rows={3}
            placeholder="Ex: Sala — Item 01 no canal 3; Item 02 no canal 1"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 resize-none"
          />
        </StepShell>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 flex items-center justify-between z-40">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Valor Estimado</p>
          <p className="text-2xl font-semibold">R$ {fmtBRL(price)}</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={cn(
            'bg-zinc-900 text-white px-8 py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200',
            !canAdd && 'opacity-50 cursor-not-allowed',
          )}
        >
          {initialItem ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </motion.div>
  );
}
