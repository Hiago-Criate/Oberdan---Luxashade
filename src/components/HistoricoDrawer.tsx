import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Clock, ShoppingBag } from 'lucide-react';
import { BRAND_LABEL } from '../data/brands';
import type { PedidoSalvo } from '../data/pedidos';

interface Props {
  open: boolean;
  loading: boolean;
  pedidos: PedidoSalvo[];
  onClose: () => void;
  onSelect: (p: PedidoSalvo) => void;
  onRemove: (id: string) => void;
}

const fmtBRL = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function fmtData(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

// Painel lateral (menu) com o histórico de pedidos/orçamentos do CNPJ. A revenda
// toca em um pedido para reabri-lo no carrinho (editar/reenviar), ou remove-o.
export function HistoricoDrawer({ open, loading, pedidos, onClose, onSelect, onRemove }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="hist-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm z-50"
          />
          <motion.div
            key="hist-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28 }}
            className="fixed top-0 right-0 h-svh w-full max-w-sm bg-zinc-50 z-50 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 bg-white">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-zinc-500" />
                <h2 className="text-lg font-medium">Meus pedidos</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loading ? (
                <p className="text-center text-sm text-zinc-400 py-12">Carregando…</p>
              ) : pedidos.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <ShoppingBag size={40} className="mx-auto text-zinc-300 mb-3" />
                  <p className="text-sm text-zinc-500">Você ainda não tem pedidos salvos por aqui.</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Ao gerar um orçamento ou pedido, ele fica guardado neste CNPJ.
                  </p>
                </div>
              ) : (
                pedidos.map((p) => {
                  const isPedido = p.tipo === 'pedido';
                  const nItens = p.itens?.length ?? 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelect(p)}
                      className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-zinc-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={
                            'text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ' +
                            (isPedido ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600')
                          }
                        >
                          {isPedido ? 'Pedido' : 'Orçamento'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Remover este pedido do histórico?')) onRemove(p.id);
                          }}
                          className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">
                            {BRAND_LABEL[p.marca] ?? p.marca}
                            {p.numero ? ` · Nº ${p.numero}` : ''}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {nItens} {nItens === 1 ? 'item' : 'itens'} · {fmtData(p.atualizadoEm)}
                          </p>
                        </div>
                        <span className="text-base font-bold text-zinc-900 whitespace-nowrap">
                          R$ {fmtBRL(p.total)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 text-center border-t border-zinc-100 bg-white">
              <p className="text-[11px] text-zinc-400">
                Toque em um pedido para reabrir, editar e reenviar.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
