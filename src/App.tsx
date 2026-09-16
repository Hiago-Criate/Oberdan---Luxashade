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
  Clock,
  AlertTriangle,
  Lock,
  Users,
  LogOut,
  KeyRound,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import axios from 'axios';
import { OrderFlow } from './components/OrderFlow';
import { BrandPicker } from './components/BrandPicker';
import { BRAND_LABEL, type Brand } from './data/brands';
import { cn } from './utils/cn';
import { generateOrcamentoPdf, type OrcamentoPdf } from './utils/orcamentoPdf';
import { trilhoDescricao } from './utils/calculator';
import { lookupRevendaByCnpj, allowedBrandsFor, type Revenda } from './data/revenda';
import { salvarPedido, listarPedidos, excluirPedido, type PedidoSalvo } from './data/pedidos';
import { HistoricoDrawer } from './components/HistoricoDrawer';
import { modulosDuplaLabel, type OrderItem } from './types/order';
import { maskPhoneBR, parsePhoneBR, envioLegivel } from './utils/phone';
import { UsuariosModal } from './components/UsuariosModal';
import {
  revendaExigeLogin, loginRevenda, logoutRevenda, trocarMinhaSenha, type Sessao,
} from './data/sessao';

const fmtBRL = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtPct = (n: number) => `${(n || 0).toLocaleString('pt-BR')}%`;

type Step = 'landing' | 'cnpj' | 'login' | 'novasenha' | 'brand' | 'order' | 'cart' | 'final' | 'success';
type TipoEnvio = 'orcamento' | 'pedido';

const WEBHOOK_URL = 'https://212hook.criate.online/webhook/94e9c23d-4b00-40aa-8e20-8e4da2c94907';

export default function App() {
  const [step, setStep] = useState<Step>('landing');
  const [brand, setBrand] = useState<Brand>('luxashade');
  const [cnpj, setCnpj] = useState('');
  const [revenda, setRevenda] = useState<Revenda | null>(null);
  const [allowedBrands, setAllowedBrands] = useState<Brand[]>(['luxashade', 'shadexp']);
  const [cnpjErro, setCnpjErro] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  // Login do usuário DENTRO da revenda (admin da revenda ou vendedor).
  // `sessao === null` = revenda que ainda não usa login: segue como antes, com
  // as permissões completas.
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [loginErro, setLoginErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  // true só quando o banco confirmou que a revenda ainda não usa login.
  const [modoLegado, setModoLegado] = useState(false);
  // Troca de senha do próprio usuário (obrigatória no 1º acesso).
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNova2, setSenhaNova2] = useState('');
  const [senhaErro, setSenhaErro] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [stepAntesDaSenha, setStepAntesDaSenha] = useState<Step>('brand');
  // Histórico de pedidos do CNPJ (persistido no Supabase via RPCs).
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pedidoNumero, setPedidoNumero] = useState<string | null>(null);
  const [historico, setHistorico] = useState<PedidoSalvo[]>([]);
  const [histAberto, setHistAberto] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  // Item recém-duplicado: ganha um destaque por alguns segundos para a pessoa
  // achar a cópia logo abaixo do original.
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio>('pedido');
  const [userInfo, setUserInfo] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Desconto da revenda (identificada pelo CNPJ). Sem revenda/sem desconto → 0.
  const subtotal = cart.reduce((acc, it) => acc + it.price, 0);
  const descontoPct = revenda?.desconto ?? 0;
  const descontoValor = subtotal * (descontoPct / 100);
  const total = subtotal - descontoValor;
  // Telefone normalizado p/ o envio (55 + DDD + nº, com ou sem o 9 conforme o DDD).
  const fonePreview = parsePhoneBR(userInfo.phone);

  // Só o ADMIN da revenda gera pedido de fábrica. Vendedor faz só orçamento.
  //
  // `modoLegado` só fica true quando o banco CONFIRMOU que esta revenda ainda
  // não tem login. Ausência de sessão não é permissão: sem uma resposta clara,
  // ninguém gera pedido. (Antes era `!sessao`, e bastava derrubar uma chamada
  // para entrar sem login já valendo como admin.)
  const ehAdmin = sessao ? sessao.usuario.papel === 'admin' : modoLegado;
  const podeGerarPedido = ehAdmin;
  // Senha ainda é a temporária que a Luxashade (ou o admin da revenda) cadastrou.
  // Enquanto for, a tela de nova senha não tem saída além de sair da conta, e o
  // banco recusa qualquer outra coisa nessa sessão.
  const senhaObrigatoria = !!sessao?.usuario.senhaTemporaria;
  const token = sessao?.token ?? null;

  // Identifica a revenda pelo CNPJ e libera as marcas conforme o `acesso`.
  // 'not_found' → bloqueia (CNPJ sem acesso). 'error' (banco off) → libera as
  // duas marcas, sem desconto (falha técnica não é falta de autorização).
  const identificarECont = async () => {
    setLookingUp(true);
    setCnpjErro('');
    // Trocar de CNPJ derruba quem estava logado. Sem isto, a sessão da revenda
    // A continuaria valendo dentro da revenda B (dá para chegar aqui pelo
    // "Trocar CNPJ" da tela de login e pelo "Voltar" da escolha de marca).
    if (sessao) await logoutRevenda(sessao.token);
    setSessao(null); setModoLegado(false);
    setHistorico([]); setCart([]);
    setPedidoId(null); setPedidoNumero(null);
    const res = await lookupRevendaByCnpj(cnpj);
    setLookingUp(false);
    if (res.status === 'not_found') {
      setCnpjErro('CNPJ não cadastrado ou sem acesso liberado. Fale com o seu vendedor.');
      return;
    }
    const r = res.revenda; // 'found' → revenda; 'error' → null (libera as duas marcas)
    setRevenda(r);
    if (r) {
      setUserInfo((u) => ({
        name: u.name || r.nome || '',
        phone: u.phone || maskPhoneBR(r.telefone ?? ''),
      }));
    }
    const allowed = r ? allowedBrandsFor(r.acesso) : (['luxashade', 'shadexp'] as Brand[]);
    setAllowedBrands(allowed);
    if (allowed.length === 1) setBrand(allowed[0]);

    // A revenda já tem usuários? Então pede login. Se ainda não tem, entra
    // direto (é assim que o recurso é ligado revenda por revenda).
    const exige = await revendaExigeLogin(cnpj);
    if (exige === 'erro') {
      // Não conseguimos perguntar ao banco. Não dá para "entrar direto": seria
      // exatamente o jeito de pular o login.
      setCnpjErro('Não conseguimos verificar o acesso agora. Confira a internet e tente de novo.');
      return;
    }
    if (exige === 'sim') {
      setLoginUser(''); setLoginSenha(''); setLoginErro('');
      setStep('login');
      return;
    }
    setModoLegado(true);
    // Carrega o histórico deste CNPJ em segundo plano (não trava a navegação).
    listarPedidos(cnpj).then(setHistorico);
    setStep('brand');
  };

  // Entra com o usuário da revenda (admin da revenda ou vendedor).
  const entrarComUsuario = async () => {
    setEntrando(true); setLoginErro('');
    const r = await loginRevenda(cnpj, loginUser, loginSenha);
    setEntrando(false);
    if (!r.ok || !r.sessao) { setLoginErro(r.erro || 'Usuário ou senha inválidos.'); return; }
    const nova = r.sessao;
    setSessao(nova);
    setModoLegado(false);
    setLoginSenha('');
    if (nova.usuario.senhaTemporaria) {
      // Primeiro acesso: a senha veio de outra pessoa. Cria a sua antes de tudo.
      setSenhaAtual(''); setSenhaNova(''); setSenhaNova2(''); setSenhaErro('');
      setStepAntesDaSenha('brand');
      setStep('novasenha');
      return;
    }
    listarPedidos(cnpj, nova.token).then(setHistorico);
    setStep('brand');
  };

  // Abre a troca de senha por vontade própria (não é o primeiro acesso).
  const abrirTrocaSenha = () => {
    setUsuariosAberto(false);
    setSenhaAtual(''); setSenhaNova(''); setSenhaNova2(''); setSenhaErro('');
    setStepAntesDaSenha(step === 'novasenha' ? 'brand' : step);
    setStep('novasenha');
  };

  const confirmarNovaSenha = async () => {
    if (!sessao) return;
    if (senhaNova !== senhaNova2) { setSenhaErro('As duas senhas não são iguais.'); return; }
    setSalvandoSenha(true); setSenhaErro('');
    const r = await trocarMinhaSenha(sessao.token, senhaAtual, senhaNova);
    setSalvandoSenha(false);
    if (!r.ok) { setSenhaErro(r.erro || 'Não foi possível trocar a senha.'); return; }
    const atualizada: Sessao = {
      ...sessao,
      usuario: { ...sessao.usuario, senhaTemporaria: false },
    };
    setSessao(atualizada);
    setSenhaAtual(''); setSenhaNova(''); setSenhaNova2('');
    listarPedidos(cnpj, atualizada.token).then(setHistorico);
    setStep(stepAntesDaSenha);
  };

  // Sai do usuário e volta pro começo (o CNPJ é digitado de novo).
  const sairDaConta = async () => {
    if (sessao) await logoutRevenda(sessao.token);
    setSessao(null); setModoLegado(false); setHistorico([]); setCart([]); setRevenda(null);
    setPedidoId(null); setPedidoNumero(null);
    setCnpj(''); setLoginUser(''); setLoginSenha('');
    setSenhaAtual(''); setSenhaNova(''); setSenhaNova2(''); setSenhaErro('');
    setUserInfo({ name: '', phone: '' });
    setStep('landing');
  };

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

  // Duplica o item: cópia idêntica, logo ABAIXO do original, com id novo. A ideia
  // é a pessoa clicar em "Editar" na cópia e mudar só o detalhe que difere, em
  // vez de refazer a peça do zero. (Hiago, 16/09/2026)
  const handleDuplicate = (item: OrderItem) => {
    const copia: OrderItem = {
      ...(JSON.parse(JSON.stringify(item)) as OrderItem),
      id: Math.random().toString(36).slice(2, 11),
    };
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx < 0) return [...prev, copia];
      return [...prev.slice(0, idx + 1), copia, ...prev.slice(idx + 1)];
    });
    setDestaqueId(copia.id);
    window.setTimeout(() => setDestaqueId((atual) => (atual === copia.id ? null : atual)), 3000);
  };

  // ----- Histórico de pedidos (por CNPJ) -----
  const abrirHistorico = async () => {
    setHistAberto(true);
    setHistLoading(true);
    setHistorico(await listarPedidos(cnpj, token));
    setHistLoading(false);
  };

  const carregarPedido = (p: PedidoSalvo) => {
    // Segurança: não reabrir pedido de uma marca que o CNPJ não tem mais acesso.
    if (!allowedBrands.includes(p.marca)) {
      alert('Este pedido usa uma marca que não está mais liberada para o seu CNPJ. Fale com o vendedor.');
      setHistAberto(false);
      return;
    }
    setCart(p.itens);
    setBrand(p.marca);
    // clienteFone não vem no histórico (dado sensível) → preserva o atual.
    setUserInfo((u) => ({ name: p.clienteNome || u.name, phone: maskPhoneBR(p.clienteFone ?? '') || u.phone }));
    // Usa a revenda ATUAL do CNPJ (desconto vigente); snapshot só como fallback.
    setRevenda(revenda ?? p.revenda);
    setPedidoId(p.id);
    setPedidoNumero(p.numero);
    setTipoEnvio(p.tipo);
    setEditingItem(null);
    setHistAberto(false);
    setStep('cart');
  };

  const removerPedido = async (id: string) => {
    const ok = await excluirPedido(id, cnpj, token);
    if (ok) setHistorico((prev) => prev.filter((p) => p.id !== id));
  };

  const handleFinalize = async () => {
    // O WhatsApp recebe o número cru, já no formato do DDD. Trava de segurança:
    // o botão já exige telefone válido, mas nunca enviar um número malformado.
    const fone = parsePhoneBR(userInfo.phone);
    if (!fone.ok) {
      alert('Confira o telefone antes de enviar.');
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      // Nº provisório do documento (o número oficial é atribuído depois no TOTVS).
      const numero = pedidoNumero || String(now.getTime()).slice(-6);

      // Enriquece itens de trilho com a descrição completa de fábrica (aparece no
      // PDF, no histórico e no webhook). Pedidos reabertos sem descrição também
      // são preenchidos aqui.
      const items = cart.map((it) =>
        it.kind === 'trilho' && !it.descricao
          ? { ...it, descricao: trilhoDescricao(it.model, it.opening, it.railColor) ?? undefined }
          : it,
      );

      // Gera o PDF do orçamento/pedido no modelo do TOTVS. Se falhar, segue
      // enviando os dados estruturados (não perde o pedido).
      let pdf: OrcamentoPdf | null = null;
      try {
        pdf = await generateOrcamentoPdf({
          tipo: tipoEnvio,
          marca: brand,
          cnpj,
          customer: userInfo,
          vendedor: revenda?.vendedor ?? null,
          codCliente: revenda?.codigo ?? null,
          loja: revenda?.loja ?? null,
          filial: revenda?.filial ?? null,
          codVendedor: revenda?.codVendedor ?? null,
          items,
          subtotal,
          descontoPct,
          descontoValor,
          total,
          numero,
          now,
        });
      } catch (e) {
        console.error('PDF generation failed:', e);
      }

      // REGISTRA ANTES DE ENVIAR, e só envia se o banco aceitar.
      // O banco é quem decide se esta pessoa pode gerar PEDIDO de fábrica. Antes
      // a recusa virava um `null` silencioso e o WhatsApp saía assim mesmo, com
      // a tela dizendo "Pedido Enviado!": a trava era só enfeite.
      const salvo = await salvarPedido({
        id: pedidoId,
        cnpj,
        marca: brand,
        tipo: tipoEnvio,
        numero,
        clienteNome: userInfo.name,
        clienteFone: userInfo.phone,
        itens: items,
        subtotal,
        descontoPct,
        descontoValor,
        total,
        revenda,
      }, token);

      if (!salvo.ok) {
        alert(salvo.erro || 'Não conseguimos registrar agora. Tente de novo.');
        if (salvo.trocarSenha) {
          setStepAntesDaSenha('cart');
          setStep('novasenha');
        } else if (salvo.sessaoMorta) {
          setSessao(null); setModoLegado(false);
          setLoginUser(''); setLoginSenha('');
          setLoginErro('Sua sessão expirou. Entre de novo para continuar.');
          setStep('login');
        }
        return;   // nada de WhatsApp para o cliente nem para a fábrica
      }
      if (salvo.id) {
        setPedidoId(salvo.id);
        setPedidoNumero(numero);
      }

      await axios.post(WEBHOOK_URL, {
        // v5: + desconto por revenda (subtotal/descontoPct/descontoValor) e bloco
        // `revenda`. v4 trouxe numeroOrcamento e pdf; v3, item 'emissor' + observacao.
        schemaVersion: 5,
        tipo: tipoEnvio,
        marca: brand,
        cnpj,
        // phone vai no formato que o envio exige (55 + DDD + nº sem o 9 inicial);
        // o n8n usa este valor direto em `number`.
        customer: { ...userInfo, phone: fone.envio },
        // Revenda identificada pelo CNPJ (null se não cadastrada). `total` já é o
        // valor COM desconto aplicado; subtotal é o bruto.
        revenda,
        numeroOrcamento: numero,
        // numeroItem = posição (1-based) na ordem do pedido; é a referência usada
        // nas observações ("Item 01 → canal 3", "lado a lado com o Item 02").
        items: items.map((it, i) => ({ numeroItem: i + 1, ...it })),
        subtotal,
        descontoPct,
        descontoValor,
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

  // As duas marcas com o MESMO tamanho visual. Usa as versões `-tight` (recortadas):
  // os arquivos originais são telas 1755x2194 com muita margem transparente, e como
  // a arte da ShadeXP é uma faixa fina, dimensionar por altura a deixava minúscula.
  // Recortadas + largura igual = as duas logos ficam equivalentes. (Lília, 2026-08-20)
  const Header = () => (
    <div className="pt-12 pb-8 flex flex-col items-center gap-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <img src="/logo-luxashade-tight.png" alt="Luxashade" className="w-32 h-auto object-contain" />
      </motion.div>
      <div className="h-px w-12 bg-zinc-200" />
      <img src="/logo-shadexp-tight.png" alt="ShadeXP" className="w-32 h-auto object-contain" />
    </div>
  );

  return (
    <div className="min-h-svh bg-zinc-50 font-sans text-zinc-900 selection:bg-zinc-200">
      <div className="max-w-md mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="min-h-svh flex flex-col justify-between py-12"
            >
              <Header />
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

          {step === 'brand' && (
            <BrandPicker
              key="brand"
              allowed={allowedBrands}
              onSelect={(b) => { setBrand(b); setStep('order'); }}
              onBack={() => setStep('cnpj')}
            />
          )}

          {step === 'cnpj' && (
            <motion.div
              key="cnpj"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="min-h-svh flex flex-col justify-center gap-8"
            >
              <div className="space-y-3">
                <Header />
                <h2 className="text-2xl font-light text-zinc-800">Identificação</h2>
                <p className="text-zinc-500 text-sm">
                  Informe o CNPJ da sua empresa para liberar o acesso
                </p>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => { setCnpj(e.target.value); if (cnpjErro) setCnpjErro(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && cnpj && !lookingUp) identificarECont(); }}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                  />
                </div>
                {cnpjErro && <p className="text-sm text-red-600 px-1 leading-snug">{cnpjErro}</p>}
              </div>
              <button
                disabled={!cnpj || lookingUp}
                onClick={identificarECont}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {lookingUp ? 'Identificando...' : 'Continuar'}
                {!lookingUp && <ArrowRight size={20} />}
              </button>
              <button
                onClick={() => setStep('landing')}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors mx-auto"
              >
                ← Voltar
              </button>
            </motion.div>
          )}

          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="min-h-svh flex flex-col justify-center gap-8"
            >
              <div className="space-y-3">
                <Header />
                <h2 className="text-2xl font-light text-zinc-800">Entrar</h2>
                <p className="text-zinc-500 text-sm">
                  {revenda?.nome
                    ? <>Acesso de <span className="font-medium text-zinc-700">{revenda.nome}</span>. Informe seu usuário e senha.</>
                    : 'Informe seu usuário e senha.'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="Usuário"
                    value={loginUser}
                    onChange={(e) => { setLoginUser(e.target.value); if (loginErro) setLoginErro(''); }}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="password"
                    placeholder="Senha"
                    value={loginSenha}
                    onChange={(e) => { setLoginSenha(e.target.value); if (loginErro) setLoginErro(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && loginUser && loginSenha && !entrando) entrarComUsuario(); }}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                  />
                </div>
                {loginErro && <p className="text-sm text-red-600 px-1 leading-snug">{loginErro}</p>}
              </div>

              <button
                disabled={!loginUser || !loginSenha || entrando}
                onClick={entrarComUsuario}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {entrando ? 'Entrando...' : 'Entrar'}
                {!entrando && <ArrowRight size={20} />}
              </button>

              <button
                onClick={() => { setLoginErro(''); setStep('cnpj'); }}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors mx-auto"
              >
                ← Trocar CNPJ
              </button>
            </motion.div>
          )}

          {step === 'novasenha' && sessao && (
            <motion.div
              key="novasenha"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="min-h-svh flex flex-col justify-center gap-8"
            >
              <div className="space-y-3">
                <Header />
                <h2 className="text-2xl font-light text-zinc-800">
                  {senhaObrigatoria ? 'Crie a sua senha' : 'Trocar a minha senha'}
                </h2>
                {senhaObrigatoria ? (
                  <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <ShieldCheck className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-amber-900 leading-snug">
                      A senha que você usou foi cadastrada por outra pessoa e é temporária.
                      Escolha agora uma senha que só você saiba. A partir daí, ninguém da
                      Luxashade consegue entrar no lugar da sua revenda.
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    Entrando como <span className="font-medium text-zinc-700">{sessao.usuario.login}</span>.
                    Informe a senha atual e escolha a nova.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {!senhaObrigatoria && (
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Senha atual"
                      value={senhaAtual}
                      onChange={(e) => { setSenhaAtual(e.target.value); if (senhaErro) setSenhaErro(''); }}
                      className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                    />
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Nova senha (mín. 4 caracteres)"
                    value={senhaNova}
                    onChange={(e) => { setSenhaNova(e.target.value); if (senhaErro) setSenhaErro(''); }}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    value={senhaNova2}
                    onChange={(e) => { setSenhaNova2(e.target.value); if (senhaErro) setSenhaErro(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && senhaNova && senhaNova2 && !salvandoSenha) confirmarNovaSenha();
                    }}
                    className="w-full bg-white border border-zinc-200 rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-lg"
                  />
                </div>
                {senhaErro && <p className="text-sm text-red-600 px-1 leading-snug">{senhaErro}</p>}
              </div>

              <button
                disabled={
                  !senhaNova || !senhaNova2 || salvandoSenha ||
                  (!senhaObrigatoria && !senhaAtual)
                }
                onClick={confirmarNovaSenha}
                className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {salvandoSenha ? 'Salvando...' : 'Salvar senha'}
                {!salvandoSenha && <ArrowRight size={20} />}
              </button>

              {/* Sem saída no 1º acesso: ou cria a senha, ou sai da conta. */}
              <button
                onClick={senhaObrigatoria ? sairDaConta : () => setStep(stepAntesDaSenha)}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors mx-auto"
              >
                {senhaObrigatoria ? 'Sair da conta' : '← Voltar'}
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
                setStep(cart.length ? 'cart' : 'brand');
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
                    src={brand === 'shadexp' ? '/logo-shadexp-tight.png' : '/logo-luxashade-tight.png'}
                    alt={BRAND_LABEL[brand]}
                    className="w-28 h-auto object-contain object-left mb-1"
                  />
                  <h2 className="text-2xl font-medium flex items-center gap-2">
                    <ShoppingBag size={24} />
                    Seu Pedido
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
              </div>

              {revenda && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-800">{revenda.nome}</p>
                  <p className="text-xs text-emerald-600">
                    {descontoPct > 0
                      ? `Desconto de ${fmtPct(descontoPct)} aplicado a este orçamento.`
                      : 'Cliente identificado · sem desconto cadastrado.'}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {cart.map((item, idx) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    numero={idx + 1}
                    destaque={item.id === destaqueId}
                    onEdit={() => handleEdit(item)}
                    onDuplicate={() => handleDuplicate(item)}
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
                {descontoPct > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Subtotal</span>
                      <span className="text-zinc-500">R$ {fmtBRL(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600 font-medium">Desconto ({fmtPct(descontoPct)})</span>
                      <span className="text-emerald-600 font-medium">− R$ {fmtBRL(descontoValor)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Total</span>
                  <span className="text-2xl font-bold">
                    R$ {fmtBRL(total)}
                  </span>
                </div>
                <div className={cn('grid gap-3', podeGerarPedido ? 'grid-cols-2' : 'grid-cols-1')}>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => { setTipoEnvio('orcamento'); setStep('final'); }}
                    className="bg-white text-zinc-900 border border-zinc-300 py-4 rounded-2xl font-medium disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                  >
                    Gerar Orçamento
                  </button>
                  {podeGerarPedido && (
                    <button
                      disabled={cart.length === 0}
                      onClick={() => { setTipoEnvio('pedido'); setStep('final'); }}
                      className="bg-zinc-900 text-white py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200 disabled:opacity-50 leading-tight"
                    >
                      Gerar Pedido na Fábrica
                    </button>
                  )}
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
              className="min-h-svh flex flex-col justify-center gap-8"
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
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <span className="absolute left-11 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none pointer-events-none">
                      +55
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="(62) 99159-2150"
                      value={userInfo.phone}
                      onChange={(e) => setUserInfo({ ...userInfo, phone: maskPhoneBR(e.target.value) })}
                      className={cn(
                        'w-full bg-white border rounded-2xl py-5 pl-20 pr-4 focus:outline-none focus:ring-2 transition-all',
                        fonePreview.aviso
                          ? 'border-amber-300 focus:ring-amber-500/10'
                          : 'border-zinc-200 focus:ring-zinc-900/5',
                      )}
                    />
                  </div>

                  {/* Conduz a pessoa até o formato certo e mostra o número exato
                      que será usado no envio — não dá pra errar sem perceber. */}
                  {fonePreview.aviso ? (
                    <p className="flex items-center gap-1.5 text-amber-600 text-xs pl-1">
                      <AlertTriangle size={13} /> {fonePreview.aviso}
                    </p>
                  ) : fonePreview.ok ? (
                    <div className="text-xs pl-1 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 size={13} />
                        Enviaremos para <span className="font-medium tabular-nums">{envioLegivel(fonePreview)}</span>
                      </p>
                      {fonePreview.removeuNove && (
                        <p className="text-zinc-400 pl-[1.15rem]">
                          Tiramos o 9 inicial: é assim que o WhatsApp registra os números do DDD {fonePreview.ddd}.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs pl-1">
                      DDD + número do WhatsApp. O 55 já está incluso.
                    </p>
                  )}
                </div>
              </div>

              <button
                disabled={!userInfo.name || !fonePreview.ok || loading}
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
              className="min-h-svh flex flex-col items-center justify-center text-center gap-6"
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
      {cnpj && (step === 'brand' || step === 'cart' || step === 'final') && (
        <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-md mx-auto px-6 flex items-center justify-end gap-2 pt-4">
            {/* Admin da revenda enxerga os orçamentos de todos; vendedor, só os dele. */}
            <button
              onClick={abrirHistorico}
              className="pointer-events-auto bg-white border border-zinc-200 shadow-md rounded-full h-11 px-3.5 flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900 hover:shadow-lg transition-all"
              aria-label={sessao && sessao.usuario.papel === 'admin' ? 'Orçamentos da revenda' : 'Meus pedidos'}
            >
              <Clock size={17} />
              <span className="text-xs font-semibold">
                {sessao && sessao.usuario.papel === 'admin' ? 'Orçamentos' : 'Meus pedidos'}
              </span>
              {historico.length > 0 && (
                <span className="bg-zinc-900 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {historico.length}
                </span>
              )}
            </button>

            {sessao && sessao.usuario.papel === 'admin' && (
              <button
                onClick={() => setUsuariosAberto(true)}
                className="pointer-events-auto bg-white border border-zinc-200 shadow-md rounded-full h-11 w-11 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:shadow-lg transition-all"
                aria-label="Usuários da revenda"
                title="Usuários"
              >
                <Users size={17} />
              </button>
            )}

            {sessao && !senhaObrigatoria && (
              <button
                onClick={abrirTrocaSenha}
                className="pointer-events-auto bg-white border border-zinc-200 shadow-md rounded-full h-11 w-11 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:shadow-lg transition-all"
                aria-label="Trocar a minha senha"
                title="Trocar a minha senha"
              >
                <KeyRound size={17} />
              </button>
            )}

            {sessao && (
              <button
                onClick={sairDaConta}
                className="pointer-events-auto bg-white border border-zinc-200 shadow-md rounded-full h-11 w-11 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:shadow-lg transition-all"
                aria-label={`Sair (${sessao.usuario.nome || sessao.usuario.login})`}
                title={`Sair · ${sessao.usuario.nome || sessao.usuario.login}`}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      {usuariosAberto && sessao && (
        <UsuariosModal
          token={sessao.token}
          meuId={sessao.usuario.id}
          onMinhaSenha={abrirTrocaSenha}
          onClose={() => setUsuariosAberto(false)}
        />
      )}
      <HistoricoDrawer
        open={histAberto}
        loading={histLoading}
        pedidos={historico}
        onClose={() => setHistAberto(false)}
        onSelect={carregarPedido}
        onRemove={removerPedido}
      />
    </div>
  );
}

interface CartItemProps {
  item: OrderItem;
  numero: number;
  destaque?: boolean;       // recém-duplicado
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function CartItemCard({ item, numero, destaque, onEdit, onDuplicate, onRemove }: CartItemProps) {
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
  const modLabel = item.kind === 'shade' ? modulosDuplaLabel(item) : null;

  return (
    <motion.div
      layout
      className={cn(
        'bg-white border p-5 rounded-3xl shadow-sm space-y-4 transition-all duration-500',
        destaque ? 'border-zinc-900 ring-4 ring-zinc-900/10' : 'border-zinc-100',
      )}
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
        {modLabel && (
          <>
            <span>•</span>
            <span>Mód. {modLabel}</span>
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
        {item.kind === 'trilho' && item.curvaDescricao && (
          <>
            <span>•</span>
            <span>{item.curvaDescricao}</span>
          </>
        )}
        {item.kind === 'trilho' && item.fixacao && (
          <>
            <span>•</span>
            <span>{item.fixacao}</span>
          </>
        )}
        {item.kind === 'trilho' && item.pesoMaxKg != null && (
          <>
            <span>•</span>
            <span>cortina até {item.pesoMaxKg} kg</span>
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
          onClick={onDuplicate}
          title="Cria uma cópia deste item logo abaixo, para editar só o que muda"
          className="flex-1 bg-zinc-50 text-zinc-600 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
        >
          <Copy size={14} /> Duplicar
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
