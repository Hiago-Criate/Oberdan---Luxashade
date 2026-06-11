import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Building2,
  User,
  Phone,
} from 'lucide-react';
import axios from 'axios';
import { OrderFlow } from './components/OrderFlow';
import { BrandPicker } from './components/BrandPicker';
import { BRAND_LABEL, type Brand } from './data/brands';
import { cn } from './utils/cn';
import { generateOrcamentoPdf, type OrcamentoPdf } from './utils/orcamentoPdf';
import type { OrderItem } from './types/order';

type Step = 'landing' | 'brand' | 'cnpj' | 'order' | 'cart' | 'final' | 'success';
type TipoEnvio = 'orcamento' | 'pedido';

const WEBHOOK_URL = 'https://147hook.criate.online/webhook/94e9c23d-4b00-40aa-8e20-8e4da2c94907';

export default function App() {
  const [step, setStep] = useState<Step>('landing');
  const [brand, setBrand] = useState<Brand>('luxashade');
  const [cnpj, setCnpj] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio>('pedido');
  const [userInfo, setUserInfo] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const total = cart.reduce((acc, it) => acc + it.price, 0);

  const upsertItem = (item: OrderItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    setEditingItem(null);
    setStep('cart');
  };

  const handleEdit = (it: OrderItem) => {
    setEditingItem(it);
    setStep('order');
  };

  const handleRemove = (id: string) => {
    setCart((prev) => prev.filter((it) => it.id !== id));
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const now = new Date();
      // Nº provisório do documento (o número oficial é atribuído depois no TOTVS).
      const numero = String(now.getTime()).slice(-6);

      // Gera o PDF do orçamento/pedido no modelo do TOTVS. Se falhar, segue
      // enviando os dados estruturados (não perde o pedido).
      let pdf: OrcamentoPdf | null = null;
      try {
        pdf = await generateOrcamentoPdf({
          tipo: tipoEnvio,
          marca: brand,
          cnpj,
          customer: userInfo,
          items: cart,
          total,
          numero,
          now,
        });
      } catch (e) {
        console.error('PDF generation failed:', e);
      }

      await axios.post(WEBHOOK_URL, {
        // v4: + numeroOrcamento e pdf (base64). v3 trouxe item 'emissor' + observacao.
        schemaVersion: 4,
        tipo: tipoEnvio,
        marca: brand,
        cnpj,
        customer: userInfo,
        numeroOrcamento: numero,
        // numeroItem = posição (1-based) na ordem do pedido; é a referência usada
        // nas observações ("Item 01 → canal 3", "lado a lado com o Item 02").
        items: cart.map((it, i) => ({ numeroItem: i + 1, ...it })),
        total,
        // PDF pronto p/ anexar/encaminhar no n8n (Convert to File a partir do base64).
        pdf,
      });
      setStep('success');
    } catch (e) {
      console.error('Submission error:', e);
      alert(tipoEnvio === 'orcamento'
        ? 'Erro ao enviar orçamento. Tente novamente.'
        : 'Erro ao enviar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const Header = () => (
    <div className="pt-12 pb-8 flex flex-col items-center gap-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <img src="/logo-luxashade.png" alt="Luxashade" className="h-40 object-contain" />
      </motion.div>
      <div className="h-px w-12 bg-zinc-200" />
      <img src="/logo-shadexp.png" alt="ShadeXP" className="h-20 object-contain opacity-70" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-zinc-200">
      <div className="max-w-md mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-screen flex flex-col justify-between py-12"
            >
              <Header />
              <div className="flex-1 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('brand')}
                  className="bg-zinc-900 text-white px-10 py-5 rounded-full text-lg font-medium shadow-xl shadow-zinc-200 flex items-center gap-3"
                >
                  Iniciar Pedido
                  <ArrowRight size={20} />
                </motion.button>
              </div>
              <div className="text-center text-zinc-400 text-sm font-light">
                Qualidade e Elegância em cada detalhe
              </div>
            </motion.div>
          )}

          {step === 'brand' && (
            <BrandPicker
              key="brand"
              onSelect={(b) => { setBrand(b); setStep('cnpj'); }}
              onBack={() => setStep('landing')}
            />
          )}

          {step === 'cnpj' && (
            <motion.div
              key="cnpj"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-screen flex flex-col justify-center gap-8"
            >
              <div className="space-y-3">
                <img
                  src={brand === 'shadexp' ? '/logo-shadexp.png' : '/logo-luxashade.png'}
                  alt={BRAND_LABEL[brand]}
                  className="h-28 object-contain object-left"
                />
                <h2 className="text-2xl font-light text-zinc-800">Identificação</h2>
                <p className="text-zinc-500 text-sm">Por favor, informe o CNPJ da empresa</p>
              </div>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                />
              </div>
              <button
                disabled={!cnpj}
                onClick={() => setStep('order')}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 'order' && (
            <OrderFlow
              key={editingItem?.id ?? 'new'}
              brand={brand}
              initialItem={editingItem}
              onSave={upsertItem}
              onBack={() => {
                setEditingItem(null);
                setStep(cart.length ? 'cart' : 'cnpj');
              }}
            />
          )}

          {step === 'cart' && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="pt-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <img
                    src={brand === 'shadexp' ? '/logo-shadexp.png' : '/logo-luxashade.png'}
                    alt={BRAND_LABEL[brand]}
                    className="h-16 object-contain object-left mb-1"
                  />
                  <h2 className="text-2xl font-medium flex items-center gap-2">
                    <ShoppingBag size={24} />
                    Seu Pedido
                  </h2>
                </div>
                <span className="bg-zinc-100 px-3 py-1 rounded-full text-sm text-zinc-500">
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              <div className="space-y-4">
                {cart.map((item, idx) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    numero={idx + 1}
                    onEdit={() => handleEdit(item)}
                    onRemove={() => handleRemove(item.id)}
                  />
                ))}

                <button
                  onClick={() => {
                    setEditingItem(null);
                    setStep('order');
                  }}
                  className="w-full border-2 border-dashed border-zinc-200 py-6 rounded-3xl text-zinc-400 font-medium flex items-center justify-center gap-2 hover:border-zinc-300 hover:text-zinc-500 transition-all"
                >
                  <Plus size={20} /> Adicionar outro item
                </button>
              </div>

              <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 space-y-4 z-40">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Total</span>
                  <span className="text-2xl font-bold">
                    R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={cart.length === 0}
                    onClick={() => { setTipoEnvio('orcamento'); setStep('final'); }}
                    className="bg-white text-zinc-900 border border-zinc-300 py-4 rounded-2xl font-medium disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                  >
                    Gerar Orçamento
                  </button>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => { setTipoEnvio('pedido'); setStep('final'); }}
                    className="bg-zinc-900 text-white py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200 disabled:opacity-50 leading-tight"
                  >
                    Gerar Pedido na Fábrica
                  </button>
                </div>
              </div>
              <div className="h-44" />
            </motion.div>
          )}

          {step === 'final' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-screen flex flex-col justify-center gap-8"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-light text-zinc-800">Quase lá...</h2>
                <p className="text-zinc-500 text-sm">
                  {tipoEnvio === 'orcamento'
                    ? 'Só precisamos de alguns dados pra te enviar o orçamento'
                    : 'Só precisamos de alguns dados para contato'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={userInfo.phone}
                    onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>

              <button
                disabled={!userInfo.name || !userInfo.phone || loading}
                onClick={handleFinalize}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading
                  ? 'Enviando...'
                  : tipoEnvio === 'orcamento'
                  ? 'Enviar Orçamento'
                  : 'Concluir Pedido'}
                {!loading && <CheckCircle2 size={20} />}
              </button>

              <button onClick={() => setStep('cart')} className="text-zinc-400 text-sm font-medium">
                Voltar ao carrinho
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-screen flex flex-col items-center justify-center text-center gap-6"
            >
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-light text-zinc-800">
                  {tipoEnvio === 'orcamento' ? 'Orçamento Enviado!' : 'Pedido Enviado!'}
                </h2>
                <p className="text-zinc-500 max-w-[260px] mx-auto">
                  {tipoEnvio === 'orcamento'
                    ? 'Seu orçamento foi enviado. Em breve entramos em contato com os valores e condições.'
                    : 'Seu pedido foi processado com sucesso. Entraremos em contato em breve.'}
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-8 bg-zinc-900 text-white px-10 py-5 rounded-2xl font-medium"
              >
                {tipoEnvio === 'orcamento' ? 'Novo Orçamento' : 'Novo Pedido'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CartItemProps {
  item: OrderItem;
  numero: number;
  onEdit: () => void;
  onRemove: () => void;
}

function CartItemCard({ item, numero, onEdit, onRemove }: CartItemProps) {
  const title =
    item.kind === 'trilho'
      ? item.model
      : item.kind === 'emissor'
      ? item.descricao
      : item.modelo;
  const subtitle =
    item.kind === 'trilho'
      ? item.environment || 'Sem ambiente'
      : item.kind === 'emissor'
      ? item.ambiente || 'Emissor / Controle'
      : item.ambiente || `${item.colecao} · ${item.corTecido}`;
  const canaisLabel = (n: number) => `${n} ${n === 1 ? 'canal' : 'canais'}`;
  const dims =
    item.kind === 'trilho'
      ? `${item.width || 0}x${item.height || 0}mm`
      : item.kind === 'emissor'
      ? `${item.motorBrand} · ${canaisLabel(item.canais)}`
      : `${item.widthMm}x${item.heightMm}mm`;

  return (
    <motion.div
      layout
      className="bg-white border border-zinc-100 p-5 rounded-3xl shadow-sm space-y-4"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <span className="text-zinc-900">Item {String(numero).padStart(2, '0')}</span>
            <span className="text-zinc-300">·</span>
            <span
              className={cn(
                item.kind === 'trilho'
                  ? 'text-amber-600'
                  : item.kind === 'emissor'
                  ? 'text-violet-600'
                  : 'text-emerald-600',
              )}
            >
              {item.productCategory}
            </span>
          </p>
          <h3 className="font-medium text-zinc-800 text-sm leading-snug break-words">{title}</h3>
          <p className="text-zinc-400 text-xs truncate">{subtitle}</p>
          {(item.kind === 'shade' || item.kind === 'emissor') && (
            <p className="text-zinc-400 text-[10px] font-mono mt-1">{item.codigo}</p>
          )}
        </div>
        <p className="font-semibold whitespace-nowrap">
          R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest flex-wrap">
        <span>{dims}</span>
        <span>•</span>
        <span>{item.quantity} un</span>
        {item.kind === 'shade' && item.comandoLado && (
          <>
            <span>•</span>
            <span>
              Comando {item.comandoLado}
              {item.comandoAlturaMm ? ` ${item.comandoAlturaMm}mm` : ''}
            </span>
          </>
        )}
        {item.kind === 'shade' && item.motorLado && (
          <>
            <span>•</span>
            <span>Motor {item.motorLado}</span>
          </>
        )}
        {item.kind === 'shade' && item.modulosAssimetricos && item.moduloLargEsqMm && item.moduloLargDirMm && (
          <>
            <span>•</span>
            <span>Mód. E {item.moduloLargEsqMm} / D {item.moduloLargDirMm}mm</span>
          </>
        )}
        {item.kind === 'shade' && item.mesmoAmbiente && (
          <>
            <span>•</span>
            <span>Mesmo ambiente</span>
          </>
        )}
        {item.kind === 'shade' && item.ladoALado && (
          <>
            <span>•</span>
            <span>Lado a lado{item.ladoALadoCom ? `: ${item.ladoALadoCom}` : ''}</span>
          </>
        )}
      </div>
      {item.observacao && (
        <div className="bg-zinc-50 rounded-2xl px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-0.5">
            Observação
          </p>
          <p className="text-[11px] text-zinc-600 whitespace-pre-wrap break-words">{item.observacao}</p>
        </div>
      )}
      {item.kind === 'shade' && item.opcionais && item.opcionais.length > 0 && (
        <div className="bg-zinc-50 rounded-2xl px-3 py-2 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            Opcionais
          </p>
          {item.opcionais.map((o) => (
            <div key={o.codigo} className="flex justify-between text-[11px] text-zinc-500">
              <span className="truncate pr-2">{o.descricao}</span>
              <span>R$ {o.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onEdit}
          className="flex-1 bg-zinc-50 text-zinc-600 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
        >
          <Edit2 size={14} /> Editar
        </button>
        <button
          onClick={onRemove}
          className="flex-1 bg-zinc-50 text-red-500 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </motion.div>
  );
}
