import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { calculatePrice, getTrilhoModelNames } from '../../utils/calculator';
import { getMotors } from '../../utils/motorPrices';
import { CURVAS_TRILHO, curvaByCodigo } from '../../data/trilhoCurvas';
import { motorsForTrilho, validarTrilho, LARGURA_MAX_TRILHO_MM } from '../../data/trilhoPeso';
import { cn } from '../../utils/cn';
import type { TrilhoItem } from '../../types/order';
import type { Brand } from '../../data/brands';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtM = (mm: number) => (mm / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const OPENINGS = ['Lateral esquerdo', 'Lateral direita', 'Central'];
const COLORS = ['Branco', 'Preto'];
const MOTOR_SIDES = ['Direito', 'Esquerdo'];
const FIXACOES = ['Teto', 'Parede (1 trilho)', 'Parede (2 trilhos)'];

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
      fixacao: 'Teto',
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

  // ----- Regras da tabela peso (trilhos.txt) -----
  const larguraMm = Number(item.width) || 0;
  const larguraExcede = larguraMm > LARGURA_MAX_TRILHO_MM;
  // Motores viáveis para esta largura + curva + cor (filtra IV60 em PRETO, etc.).
  const motoresViaveis = motorsForTrilho(getMotors(), larguraMm, item.curvaCodigo, item.railColor || '');
  const semMotorViavel = larguraMm > 0 && !larguraExcede && motoresViaveis.length === 0;
  const viab = item.motor ? validarTrilho(item.motor, item.curvaCodigo, larguraMm) : null;
  const temCurva = !!item.curvaCodigo;
  const prazoDias = temCurva ? 7 : 3;

  // Limpa o motor se ele deixar de ser viável (mudou largura / curva / cor).
  useEffect(() => {
    if (item.motor && !motoresViaveis.includes(item.motor)) {
      setItem((prev) => ({ ...prev, motor: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [larguraMm, item.curvaCodigo, item.railColor]);

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
      fixacao: item.fixacao,
      pesoMaxKg: viab?.pesoMaxKg ?? undefined,
      prazoDias,
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
      {larguraExcede && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] leading-snug text-red-600">
            A largura do trilho é de no máximo <span className="font-semibold">15.000 mm (15 m)</span>.
          </p>
        </div>
      )}

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

      {/* Curva — vem ANTES do motor: define a viabilidade (tabela peso). */}
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
        {temCurva ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] leading-snug text-amber-700">
              Trilho curvo: é necessário <span className="font-semibold">enviar o molde para a fábrica</span>. Valor fixo somado ao total.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-400">Opcional. Valor fixo por trilho, somado ao total.</p>
        )}
      </div>

      {/* Motor — só lista os viáveis p/ largura + curva + cor (tabela peso). */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Motor</label>
        <div className="relative">
          <select
            value={item.motor}
            disabled={semMotorViavel}
            onChange={(e) => setItem({ ...item, motor: e.target.value })}
            className={cn(
              'w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 text-sm disabled:bg-zinc-50',
              !item.motor && 'text-zinc-400',
            )}
          >
            <option value="">Escolha o motor</option>
            {motoresViaveis.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
        </div>
        {semMotorViavel && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] leading-snug text-red-600">
              Não é possível fabricar um trilho de <span className="font-semibold">{fmtM(larguraMm)} m</span> {temCurva ? 'com essa curva' : 'reto'} com nenhum motor.
              Reduza a largura{temCurva ? ' ou remova a curva' : ''}.
            </p>
          </div>
        )}
        {viab?.ok && viab.pesoMaxKg != null && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] leading-snug text-emerald-700">
              Peso máximo da cortina: <span className="font-semibold">{viab.pesoMaxKg} kg</span>.
              Largura máx deste motor{temCurva ? ' + curva' : ''}: {viab.larguraMaxM} m.
            </p>
          </div>
        )}
      </div>

      {/* Tipo de fixação. Teto = padrão sem custo; Parede = valor repassado pelo
          vendedor (cobrança automática fica p/ depois, conforme a Lília). */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Tipo de Fixação</label>
        <div className="grid grid-cols-3 gap-2">
          {FIXACOES.map((f) => (
            <button
              key={f}
              onClick={() => setItem({ ...item, fixacao: f })}
              className={cn(
                'py-3 px-2 text-[10px] uppercase tracking-tighter rounded-xl border transition-all leading-tight',
                item.fixacao === f ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        {item.fixacao && item.fixacao !== 'Teto' && (
          <p className="text-[11px] text-zinc-400">O valor desta fixação é repassado pelo vendedor.</p>
        )}
      </div>

      {/* Prazo de produção */}
      <div className="rounded-xl bg-zinc-50 px-3 py-2">
        <p className="text-[11px] text-zinc-500">
          Prazo de produção: <span className="font-semibold text-zinc-700">{prazoDias} dias úteis</span> (trilho {temCurva ? 'curvo' : 'reto'}).
        </p>
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
          disabled={!item.opening || !item.railColor || !item.motorSide || !item.motor || larguraExcede}
          className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200 disabled:opacity-40 transition-opacity"
        >
          {initialItem ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </motion.div>
  );
}
