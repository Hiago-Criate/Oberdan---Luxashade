// Popup do ADMIN da revenda: ver quantos usuários existem e criar vendedores.
// Minimalista de propósito: lista + criar + (trocar senha / remover).
// Quem pode o quê é decidido no banco (ver `sql/usuarios_revenda.sql`); aqui é
// só a tela.

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, Trash2, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import {
  listarUsuarios, criarUsuario, removerUsuario, trocarSenhaUsuario,
  type UsuarioListado, type Papel,
} from '../data/sessao';

interface Props {
  token: string;
  meuId: string;
  /** Abre a tela de trocar a PRÓPRIA senha (fora deste popup). */
  onMinhaSenha: () => void;
  onClose: () => void;
}

export function UsuariosModal({ token, meuId, onMinhaSenha, onClose }: Props) {
  const [lista, setLista] = useState<UsuarioListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [login, setLogin] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('vendedor');

  const carregar = async () => {
    setCarregando(true);
    setLista(await listarUsuarios(token));
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async () => {
    setErro(''); setSalvando(true);
    const r = await criarUsuario(token, login, senha, nome, papel);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro || 'Não foi possível concluir.'); return; }
    setLogin(''); setNome(''); setSenha(''); setPapel('vendedor');
    carregar();
  };

  const remover = async (u: UsuarioListado) => {
    const aviso = u.papel === 'admin'
      ? `Remover o acesso de "${u.login}"? Ele é ADMINISTRADOR desta revenda.`
      : `Remover o acesso de "${u.login}"?`;
    if (!confirm(aviso)) return;
    setErro('');
    const r = await removerUsuario(token, u.id);
    if (!r.ok) { setErro(r.erro || 'Não foi possível concluir.'); return; }
    carregar();
  };

  const novaSenha = async (u: UsuarioListado) => {
    const s = prompt(`Nova senha para "${u.login}":`);
    if (!s) return;
    setErro('');
    const r = await trocarSenhaUsuario(token, u.id, s);
    if (!r.ok) { setErro(r.erro || 'Não foi possível concluir.'); return; }
    alert(`Senha temporária definida para "${u.login}". Ele entra com ela e o app vai `
      + 'pedir que escolha a senha dele. Depois disso, você não sabe mais a senha.');
    carregar();
  };

  const vendedores = lista.filter((u) => u.papel === 'vendedor').length;
  const admins = lista.filter((u) => u.papel === 'admin').length;
  const podeCriar = login.trim().length >= 3 && senha.length >= 4 && !salvando;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[88svh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-medium text-zinc-800">Usuários</h3>
            <p className="text-xs text-zinc-400">
              {carregando
                ? 'carregando…'
                : `${admins} administrador${admins === 1 ? '' : 'es'} · ${vendedores} vendedor${vendedores === 1 ? '' : 'es'}`}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1"><X size={20} /></button>
        </div>

        {/* Lista */}
        <div className="mt-4 space-y-2">
          {carregando && (
            <div className="flex items-center gap-2 text-sm text-zinc-400 py-4">
              <Loader2 size={15} className="animate-spin" /> carregando…
            </div>
          )}
          {!carregando && lista.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800 truncate">{u.login}</span>
                  {u.papel === 'admin' && (
                    <span className="text-[10px] uppercase tracking-wider bg-zinc-900 text-white rounded-full px-2 py-0.5">Admin</span>
                  )}
                  {!u.ativo && (
                    <span className="text-[10px] uppercase tracking-wider bg-zinc-100 text-zinc-500 rounded-full px-2 py-0.5">Inativo</span>
                  )}
                  {u.senhaTemporaria && (
                    <span
                      title="Ainda está com a senha temporária. Vai trocar no primeiro acesso."
                      className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 flex items-center gap-1"
                    >
                      <ShieldAlert size={10} /> senha temporária
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {u.nome ? `${u.nome} · ` : ''}{u.pedidos} orçamento{u.pedidos === 1 ? '' : 's'}
                  {u.id === meuId ? ' · você' : ''}
                </p>
              </div>
              {u.id === meuId ? (
                /* A sua própria senha se troca informando a atual, fora daqui. */
                <button onClick={onMinhaSenha} title="Trocar a minha senha"
                  className="text-zinc-400 hover:text-zinc-900 p-1"><KeyRound size={16} /></button>
              ) : (
                <>
                  <button onClick={() => novaSenha(u)} title="Definir senha temporária"
                    className="text-zinc-300 hover:text-zinc-700 p-1"><KeyRound size={16} /></button>
                  <button onClick={() => remover(u)} title="Remover"
                    className="text-zinc-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Criar vendedor */}
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-600 mb-1">Novo usuário</p>
          <div className="grid grid-cols-2 gap-2 mb-1">
            {(['vendedor', 'admin'] as Papel[]).map((op) => (
              <button
                key={op}
                onClick={() => setPapel(op)}
                className={
                  'py-2.5 rounded-xl text-sm border transition-all ' +
                  (papel === op
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300')
                }
              >
                {op === 'vendedor' ? 'Vendedor' : 'Administrador'}
              </button>
            ))}
          </div>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Usuário (ex: joao)"
            autoCapitalize="none"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome (opcional)"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
          <input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha (mín. 4 caracteres)"
            type="text"
            autoCapitalize="none"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
          <button
            disabled={!podeCriar}
            onClick={criar}
            className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {papel === 'admin' ? 'Criar administrador' : 'Criar vendedor'}
          </button>
          <p className="text-[11px] text-zinc-400 leading-snug">
            {papel === 'admin'
              ? 'O administrador gera orçamento e pedido, vê os orçamentos de toda a revenda e também cria usuários.'
              : 'O vendedor gera orçamentos e vê apenas os dele. Não emite pedido de fábrica.'}
            {' '}Entra com o mesmo CNPJ e esse usuário. A senha que você digitar é
            temporária: no primeiro acesso ele escolhe a dele, e você deixa de saber a senha.
          </p>
        </div>

        {erro && <p className="mt-3 text-sm text-red-600 leading-snug">{erro}</p>}
      </motion.div>
    </div>
  );
}
