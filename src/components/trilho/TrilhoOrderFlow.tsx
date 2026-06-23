import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { calculatePrice, getTrilhoModelNames } from '../../utils/calculator';
import { getMotors } from '../../utils/motorPrices';
import { CURVAS_TRILHO, curvaByCodigo } from '../../data/trilhoCurvas';
import { cn } from '../../utils/cn';
import type { TrilhoItem } from '../../types/order';
import type { Brand } from '../../data/brands';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const OPENINGS = ['Lateral esquerdo', 'Lateral direita', 'Central'];
const COLORS = ['Branco', 'Preto'];
const MOTOR_SIDES = ['Direito', 'Esquerdo'];

interface Props {
  brand: Brand;
  initialItem?: TrilhoItem | null;
  onSave: (item: TrilhoItem) => void;
}

// Corpo do form de Trilho Motorizado. A Categoria é selecionada no wrapper
// (OrderFlow) então aqui não mostramos o cabeçalho nem o "Categoria: Trilho".
export function TrilhoOrderFlow({ brand, initialItem, onSave }: Props) {
  const MODELS = getTrilhoModelNames();
  const [item, setItem] = useState<Partial<TrilhoItem>>(
    initialItem ?? {
      kind: 'trilho',
      brand,
      productCategory: 'Trilho',
      model: MODELS[0],
      environment: '',
      quantity: 1,
      width: '',
      height: '',
      opening: '',
      railColor: '',
      motorSide: '',
      motor: '',
      curvaCodigo: '',
      observacao: '',
      price: 0,
    },
  );

  useEffect(() => {
    if (item.width && item.model) {
      try {
        const price = calculatePrice(item);
        setItem((prev) => ({ ...prev, price }));
      } catch (e) {
        console.error('Calculation error:', e);
      }
    }
  }, [item.model, item.opening, item.railColor, item.width, item.motor, item.quantity, item.curvaCodigo]);

  const handleAdd = () => {
    if (!item.opening || !item.railColor || !item.motorSide || !item.motor) return;
    const curva = curvaByCodigo(item.curvaCodigo);
    const finalItem: TrilhoItem = {
      kind: 'trilho',
      id: initialItem?.id ?? Math.random().toString(36).slice(2, 11),
      brand,
      productCategory: 'Trilho',
      model: item.model ?? MODELS[0],
      environment: item.environment ?? '',
      quantity: item.quantity ?? 1,
      width: item.width ?? '',
      height: item.height ?? '',
      opening: item.opening,
      railColor: item.railColor,
      motorSide: item.motorSide,
      motor: item.motor,
      curvaCodigo: curva?.codigo,
      curvaDescricao: curva?.descricao,
      curvaValor: curva?.valor,
      observacao: item.observacao?.trim() || undefined,
      price: item.price ?? 0,
    };
    onSave(finalItem);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Modelo de Cortina</label>
        <div className="relative">
          <select
            value={item.model}
            onChange={(e) => setItem({ ...item, model: e.target.value })}
            className="w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Ambiente</label>
        <input
          type="text"
          placeholder="Ex: Sala de Estar"
          value={item.environment}
          onChange={(e) => setItem({ ...item, environment: e.target.value })}
          className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Largura (mm)</label>
          <input
            type="number"
            placeholder="0"
            value={item.width}
            onChange={(e) => setItem({ ...item, width: e.target.value })}
            className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Altura (mm)</label>
          <input
            type="number"
            placeholder="0"
            value={item.height}
            onChange={(e) => setItem({ ...item, height: e.target.value })}
            className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Quantidade</label>
        <div className="flex items-center justify-between bg-white border border-zinc-200 p-2 rounded-2xl">
          <button
            onClick={() => setItem((prev) => ({ ...prev, quantity: Math.max(1, (prev.quantity || 1) - 1) }))}
            className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
          >
            -
          </button>
          <span className="text-lg font-medium">{item.quantity}</span>
          <button
            onClick={() => setItem((prev) => ({ ...prev, quantity: (prev.quantity || 1) + 1 }))}
            className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Abertura</label>
        <div className="grid grid-cols-3 gap-2">
          {OPENINGS.map((o) => (
            <button
              key={o}
              onClick={() => setItem({ ...item, opening: o })}
              className={cn(
                'py-3 px-2 text-[10px] uppercase tracking-tighter rounded-xl border transition-all',
                item.opening === o ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200',
              )}
            >
              {o.split(' ')[1] || o}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Cor do Trilho</label>
        <div className="flex gap-4">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setItem({ ...item, railColor: c })}
              className={cn(
                'flex-1 py-4 rounded-2xl border flex items-center justify-center gap-2 transition-all',
                item.railColor === c ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200',
              )}
            >
              <div className={cn('w-4 h-4 rounded-full border', c === 'Branco' ? 'bg-white' : 'bg-black')} />
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Lado do Motor</label>
        <div className="flex gap-4">
          {MOTOR_SIDES.map((s) => (
            <button
              key={s}
              onClick={() => setItem({ ...item, motorSide: s })}
              className={cn(
                'flex-1 py-4 rounded-2xl border transition-all',
                item.motorSide === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Motor</label>
        <div className="relative">
          <select
            value={item.motor}
            onChange={(e) => setItem({ ...item, motor: e.target.value })}
            className={cn(
              'w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 text-sm',
              !item.motor && 'text-zinc-400',
            )}
          >
            <option value="">Escolha o motor</option>
            {getMotors().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Curva do Trilho</label>
        <div className="relative">
          <select
            value={item.curvaCodigo ?? ''}
            onChange={(e) => setItem({ ...item, curvaCodigo: e.target.value })}
            className="w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 text-sm"
          >
            <option value="">Sem curva (trilho reto)</option>
            {CURVAS_TRILHO.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.descricao} — + R$ {fmtBRL(c.valor)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
        </div>
        <p className="text-[11px] text-zinc-400">Opcional. Valor fixo por trilho, somado ao total.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Observação</label>
        <textarea
          rows={2}
          placeholder="(Opcional) Notas sobre este item para a produção."
          value={item.observacao ?? ''}
          onChange={(e) => setItem({ ...item, observacao: e.target.value })}
          className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 resize-none"
        />
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 flex items-center justify-between z-40">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Valor Estimado</p>
          <p className="text-2xl font-semibold">
            R$ {(item.price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!item.opening || !item.railColor || !item.motorSide || !item.motor}
          className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200 disabled:opacity-40 transition-opacity"
        >
          {initialItem ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </motion.div>
  );
}
