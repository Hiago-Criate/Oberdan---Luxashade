import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  ShoppingBag,
  Package,
  User,
  Phone,
  Building2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface OrderItem {
  id: string;
  productCategory: string;
  model: string;
  environment: string;
  quantity: number;
  width: string;
  height: string;
  opening: string;
  railColor: string;
  motorSide: string;
  motor: string;
  price: number;
}

type Step = 'landing' | 'cnpj' | 'order' | 'cart' | 'final' | 'success';

// --- Constants ---
const MODELS = ["Prega", "Modelo movimento", "Wave 2.4", "Wave 3.4", "Wave 1.7", "Wave 2.7"];
const OPENINGS = ["Lateral esquerdo", "Lateral direita", "Central"];
const COLORS = ["Branco", "Preto"];
const MOTOR_SIDES = ["Direito", "Esquerdo"];
const MOTORS = [
  "MOTOR SOMFY GLYDEA ULTRA 60E RTS",
  "MOTOR SOMFY GLYDEA ULTRA 60E W CONTATO SECO",
  "MOTOR SOMFY ELATIO 50KG W CONTATO SECO",
  "MOTOR SOMFY ELATIO 50KG RTS",
  "MOTOR IVOLVE IV50 N2 W CONTATO SECO",
  "MOTOR IVOLVE IV60 N1 RF + WI-FI",
  "SEM MOTOR (INFORMATIVO)"
];

export default function App() {
  const [step, setStep] = useState<Step>('landing');
  const [cnpj, setCnpj] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Current Item State
  const [currentItem, setCurrentItem] = useState<Partial<OrderItem>>({
    productCategory: 'Trilho',
    model: MODELS[0],
    environment: '',
    quantity: 1,
    width: '',
    height: '',
    opening: OPENINGS[0],
    railColor: COLORS[0],
    motorSide: MOTOR_SIDES[0],
    motor: MOTORS[6],
    price: 0
  });

  // Final Info State
  const [userInfo, setUserInfo] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Calculate price whenever relevant fields change
  useEffect(() => {
    if (step === 'order' && currentItem.width && currentItem.model) {
      const fetchPrice = async () => {
        try {
          const res = await axios.post('/api/calculate', currentItem);
          setCurrentItem(prev => ({ ...prev, price: res.data.price }));
        } catch (e) {
          console.error(e);
        }
      };
      fetchPrice();
    }
  }, [currentItem.model, currentItem.opening, currentItem.railColor, currentItem.width, currentItem.motor, currentItem.quantity, step]);

  const calculateProgress = () => {
    const fields = ['model', 'environment', 'width', 'height', 'opening', 'railColor', 'motorSide', 'motor'];
    const filled = fields.filter(f => !!(currentItem as any)[f]).length;
    return (filled / fields.length) * 100;
  };

  const handleAddToCart = () => {
    if (editingId) {
      setCart(prev => prev.map(item => item.id === editingId ? { ...currentItem, id: editingId } as OrderItem : item));
      setEditingId(null);
    } else {
      setCart(prev => [...prev, { ...currentItem, id: Math.random().toString(36).substr(2, 9) } as OrderItem]);
    }
    setStep('cart');
    // Reset current item
    setCurrentItem({
      productCategory: 'Trilho',
      model: MODELS[0],
      environment: '',
      quantity: 1,
      width: '',
      height: '',
      opening: OPENINGS[0],
      railColor: COLORS[0],
      motorSide: MOTOR_SIDES[0],
      motor: MOTORS[6],
      price: 0
    });
  };

  const handleEdit = (item: OrderItem) => {
    setCurrentItem(item);
    setEditingId(item.id);
    setStep('order');
  };

  const handleRemove = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      await axios.post('/api/submit-order', {
        cnpj,
        items: cart,
        customer: userInfo,
        total: cart.reduce((acc, item) => acc + item.price, 0)
      });
      setStep('success');
    } catch (e) {
      alert('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // --- Render Helpers ---
  const renderHeader = () => (
    <div className="pt-12 pb-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-light tracking-widest text-zinc-800 mb-2"
      >
        LUXASHADE
      </motion.div>
      <div className="h-px w-12 bg-zinc-200" />
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
              {renderHeader()}
              <div className="flex-1 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('cnpj')}
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

          {step === 'cnpj' && (
            <motion.div
              key="cnpj"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-screen flex flex-col justify-center gap-8"
            >
              <div className="space-y-2">
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
            <motion.div
              key="order"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-8 space-y-8"
            >
              {/* Progress Bar */}
              <div className="fixed top-0 left-0 w-full h-1 bg-zinc-100 z-50">
                <motion.div 
                  className="h-full bg-zinc-900"
                  initial={{ width: 0 }}
                  animate={{ width: `${calculateProgress()}%` }}
                />
              </div>

              <div className="flex items-center gap-4">
                <button onClick={() => setStep('cnpj')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-medium">Configurar Item</h2>
              </div>

              <div className="space-y-6">
                {/* Product Category - Static as per request */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Categoria</label>
                  <div className="bg-zinc-100 p-4 rounded-2xl text-zinc-600">Trilho</div>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Modelo de Cortina</label>
                  <div className="relative">
                    <select 
                      value={currentItem.model}
                      onChange={(e) => setCurrentItem({...currentItem, model: e.target.value})}
                      className="w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                    >
                      {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                  </div>
                </div>

                {/* Environment */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Ambiente</label>
                  <input 
                    type="text"
                    placeholder="Ex: Sala de Estar"
                    value={currentItem.environment}
                    onChange={(e) => setCurrentItem({...currentItem, environment: e.target.value})}
                    className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                  />
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Largura (mm)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={currentItem.width}
                      onChange={(e) => setCurrentItem({...currentItem, width: e.target.value})}
                      className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Altura (mm)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={currentItem.height}
                      onChange={(e) => setCurrentItem({...currentItem, height: e.target.value})}
                      className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                    />
                  </div>
                </div>

                {/* Quantity - Spinner style */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Quantidade</label>
                  <div className="flex items-center justify-between bg-white border border-zinc-200 p-2 rounded-2xl">
                    <button 
                      onClick={() => setCurrentItem(prev => ({...prev, quantity: Math.max(1, (prev.quantity || 1) - 1)}))}
                      className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      -
                    </button>
                    <span className="text-lg font-medium">{currentItem.quantity}</span>
                    <button 
                      onClick={() => setCurrentItem(prev => ({...prev, quantity: (prev.quantity || 1) + 1}))}
                      className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Opening */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Abertura</label>
                  <div className="grid grid-cols-3 gap-2">
                    {OPENINGS.map(o => (
                      <button
                        key={o}
                        onClick={() => setCurrentItem({...currentItem, opening: o})}
                        className={cn(
                          "py-3 px-2 text-[10px] uppercase tracking-tighter rounded-xl border transition-all",
                          currentItem.opening === o ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200"
                        )}
                      >
                        {o.split(' ')[1] || o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rail Color */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Cor do Trilho</label>
                  <div className="flex gap-4">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCurrentItem({...currentItem, railColor: c})}
                        className={cn(
                          "flex-1 py-4 rounded-2xl border flex items-center justify-center gap-2 transition-all",
                          currentItem.railColor === c ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-full border", c === 'Branco' ? 'bg-white' : 'bg-black')} />
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motor Side */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Lado do Motor</label>
                  <div className="flex gap-4">
                    {MOTOR_SIDES.map(s => (
                      <button
                        key={s}
                        onClick={() => setCurrentItem({...currentItem, motorSide: s})}
                        className={cn(
                          "flex-1 py-4 rounded-2xl border transition-all",
                          currentItem.motorSide === s ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motor */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Motor</label>
                  <div className="relative">
                    <select 
                      value={currentItem.motor}
                      onChange={(e) => setCurrentItem({...currentItem, motor: e.target.value})}
                      className="w-full appearance-none bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 text-sm"
                    >
                      {MOTORS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>

              {/* Price Footer */}
              <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 flex items-center justify-between z-40">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Valor Estimado</p>
                  <p className="text-2xl font-semibold">R$ {currentItem.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200"
                >
                  {editingId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
              <div className="h-32" /> {/* Spacer */}
            </motion.div>
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
                <h2 className="text-2xl font-medium flex items-center gap-2">
                  <ShoppingBag size={24} />
                  Seu Pedido
                </h2>
                <span className="bg-zinc-100 px-3 py-1 rounded-full text-sm text-zinc-500">{cart.length} itens</span>
              </div>

              <div className="space-y-4">
                {cart.map((item) => (
                  <motion.div 
                    layout
                    key={item.id}
                    className="bg-white border border-zinc-100 p-5 rounded-3xl shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-zinc-800">{item.model}</h3>
                        <p className="text-zinc-400 text-xs">{item.environment || 'Sem ambiente'}</p>
                      </div>
                      <p className="font-semibold">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest">
                      <span>{item.width}x{item.height}mm</span>
                      <span>•</span>
                      <span>{item.quantity} un</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="flex-1 bg-zinc-50 text-zinc-600 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
                      >
                        <Edit2 size={14} /> Editar
                      </button>
                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="flex-1 bg-zinc-50 text-red-500 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button
                  onClick={() => setStep('order')}
                  className="w-full border-2 border-dashed border-zinc-200 py-6 rounded-3xl text-zinc-400 font-medium flex items-center justify-center gap-2 hover:border-zinc-300 hover:text-zinc-500 transition-all"
                >
                  <Plus size={20} /> Adicionar outro item
                </button>
              </div>

              <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 space-y-4 z-40">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Total do Pedido</span>
                  <span className="text-2xl font-bold">R$ {cart.reduce((acc, item) => acc + item.price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <button
                  disabled={cart.length === 0}
                  onClick={() => setStep('final')}
                  className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium shadow-xl shadow-zinc-200 disabled:opacity-50"
                >
                  Finalizar Pedido
                </button>
              </div>
              <div className="h-40" />
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
                <p className="text-zinc-500 text-sm">Só precisamos de alguns dados para contato</p>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={userInfo.phone}
                    onChange={(e) => setUserInfo({...userInfo, phone: e.target.value})}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>

              <button
                disabled={!userInfo.name || !userInfo.phone || loading}
                onClick={handleFinalize}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Enviando...' : 'Concluir Pedido'}
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
                <h2 className="text-3xl font-light text-zinc-800">Pedido Enviado!</h2>
                <p className="text-zinc-500 max-w-[240px] mx-auto">
                  Seu pedido foi processado com sucesso. Entraremos em contato em breve.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-8 bg-zinc-900 text-white px-10 py-5 rounded-2xl font-medium"
              >
                Novo Pedido
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
