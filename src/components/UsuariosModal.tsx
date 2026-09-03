// Popup do ADMIN da revenda: ver quantos usuários existem e criar vendedores.
// Minimalista de propósito: lista + criar + (trocar senha / remover).
// Quem pode o quê é decidido no banco (ver `sql/usuarios_revenda.sql`); aqui é
// só a tela.

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, Trash2, KeyRound, Loader2 } from 'lucide-react';
import {
  listarUsuarios, criarUsuario, removerUsuario, trocarSenhaUsuario,
  type UsuarioListado,
} from '../data/sessao';

interface Props {
  token: string;
  meuId: string;
  onClose: () => void;
}

export function UsuariosModal({ token, meuId, onClose }: Props) {
  const [lista, setLista] = useState<UsuarioListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [login, setLogin] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setLista(await listarUsuarios(token));
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async () => {
    setErro(''); setSalvando(true);
    const r = await criarUsuario(token, login, senha, nome);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro || 'Não foi possível concluir.'); return; }
    setLogin(''); setNome(''); setSenha('');
    carregar();
  };

  const remover = async (u: UsuarioListado) => {
    if (!confirm(`Remover o acesso de "${u.login}"?`)) return;
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
    alert('Senha alterada. O vendedor precisa entrar de novo com a senha nova.');
  };

  const vendedores = lista.filter((u) => u.papel === 'vendedor').length;
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
              {carregando ? 'carregando…' : `${lista.length} no total · ${vendedores} vendedor${vendedores === 1 ? '' : 'es'}`}
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
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {u.nome ? `${u.nome} · ` : ''}{u.pedidos} orçamento{u.pedidos === 1 ? '' : 's'}
                  {u.id === meuId ? ' · você' : ''}
                </p>
              </div>
              {u.id !== meuId && (
                <button onClick={() => novaSenha(u)} title="Trocar senha"
                  className="text-zinc-300 hover:text-zinc-700 p-1"><KeyRound size={16} /></button>
              )}
              {u.papel !== 'admin' && (
                <button onClick={() => remover(u)} title="Remover"
                  className="text-zinc-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
        </div>

        {/* Criar vendedor */}
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-600 mb-1">Novo vendedor</p>
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
            Criar vendedor
          </button>
          <p className="text-[11px] text-zinc-400 leading-snug">
            O vendedor entra com o mesmo CNPJ e esse usuário e senha. Ele gera orçamentos
            e vê apenas os dele.
          </p>
        </div>

        {erro && <p className="mt-3 text-sm text-red-600 leading-snug">{erro}</p>}
      </motion.div>
    </div>
  );
}
