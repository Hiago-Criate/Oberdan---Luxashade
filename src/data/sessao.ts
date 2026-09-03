// Login por usuário dentro da revenda (admin da revenda e vendedores).
//
// Fluxo: CNPJ -> (se a revenda já tem usuário) tela de login -> resto do app.
// Enquanto a Luxashade não criar o admin daquela revenda, `revendaExigeLogin`
// devolve false e o app entra direto, como sempre foi.
//
// O login devolve um TOKEN de sessão e é o BANCO que decide o que cada papel
// pode ver/fazer (ver `sql/usuarios_revenda.sql`). O app só guarda o token em
// memória: fechou ou recarregou a página, faz login de novo.

import { supabase } from '../lib/supabase';

export type Papel = 'admin' | 'vendedor';

export interface UsuarioRevenda {
  id: string;
  login: string;
  nome: string | null;
  papel: Papel;
}

export interface Sessao {
  token: string;
  usuario: UsuarioRevenda;
}

export interface UsuarioListado extends UsuarioRevenda {
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  pedidos: number;
}

const mapUsuario = (u: any): UsuarioRevenda => ({
  id: String(u?.id ?? ''),
  login: String(u?.login ?? ''),
  nome: (u?.nome as string) ?? null,
  papel: u?.papel === 'admin' ? 'admin' : 'vendedor',
});

/** A revenda deste CNPJ já tem login configurado?
 *
 *  Três respostas, não duas. "Não consegui perguntar" NÃO pode virar "não
 *  precisa de login": bastaria derrubar esta única chamada para pular a tela de
 *  login. Em falha devolvemos 'erro' e o app pede para tentar de novo.
 *  A única exceção é a RPC não existir (banco ainda sem a migração): aí a
 *  revenda realmente não tem login, e o app entra como sempre entrou. */
export type ExigeLogin = 'sim' | 'nao' | 'erro';

export async function revendaExigeLogin(cnpj: string): Promise<ExigeLogin> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!digits) return 'nao';
  try {
    const { data, error } = await supabase.rpc('revenda_exige_login', { p_cnpj: digits });
    if (error) {
      // PGRST202 = função inexistente no schema. Banco sem a migração: modo antigo.
      return (error as any)?.code === 'PGRST202' ? 'nao' : 'erro';
    }
    return data === true ? 'sim' : 'nao';
  } catch {
    return 'erro';
  }
}

// Formato simples (sem união discriminada): o projeto compila com
// `strictNullChecks` desligado e nesse modo o TS não estreita união por boolean.
export interface LoginResultado { ok: boolean; sessao?: Sessao; erro?: string }

export async function loginRevenda(cnpj: string, login: string, senha: string): Promise<LoginResultado> {
  const digits = (cnpj || '').replace(/\D/g, '');
  try {
    const { data, error } = await supabase.rpc('login_revenda', {
      p_cnpj: digits, p_login: login, p_senha: senha,
    });
    if (error) return { ok: false, erro: 'Não conseguimos validar agora. Tente de novo.' };
    if (!data?.ok) {
      return {
        ok: false,
        erro: data?.motivo === 'dados'
          ? 'Preencha usuário e senha.'
          : 'Usuário ou senha inválidos.',
      };
    }
    return { ok: true, sessao: { token: String(data.token), usuario: mapUsuario(data.usuario) } };
  } catch {
    return { ok: false, erro: 'Não conseguimos validar agora. Tente de novo.' };
  }
}

export async function logoutRevenda(token: string): Promise<void> {
  try { await supabase.rpc('logout_revenda', { p_token: token }); } catch { /* ignora */ }
}

// ---------------------------------------------------- usuários (só o admin) ---
export async function listarUsuarios(token: string): Promise<UsuarioListado[]> {
  try {
    const { data, error } = await supabase.rpc('listar_usuarios_revenda', { p_token: token });
    if (error || !Array.isArray(data)) return [];
    return data.map((u: any) => ({
      ...mapUsuario(u),
      ativo: u.ativo !== false,
      criadoEm: String(u.criado_em ?? ''),
      ultimoAcesso: (u.ultimo_acesso as string) ?? null,
      pedidos: Number(u.pedidos) || 0,
    }));
  } catch {
    return [];
  }
}

export interface AcaoResultado { ok: boolean; erro?: string }

const resultado = (data: any, error: any, padrao: string): AcaoResultado => {
  if (error) return { ok: false, erro: padrao };
  if (!data?.ok) return { ok: false, erro: String(data?.motivo || padrao) };
  return { ok: true };
};

export async function criarUsuario(
  token: string, login: string, senha: string, nome: string,
): Promise<AcaoResultado> {
  try {
    const { data, error } = await supabase.rpc('criar_usuario_revenda', {
      p_token: token, p_login: login, p_senha: senha, p_nome: nome,
    });
    return resultado(data, error, 'Não foi possível criar o usuário.');
  } catch {
    return { ok: false, erro: 'Não foi possível criar o usuário.' };
  }
}

export async function removerUsuario(token: string, id: string): Promise<AcaoResultado> {
  try {
    const { data, error } = await supabase.rpc('remover_usuario_revenda', { p_token: token, p_id: id });
    return resultado(data, error, 'Não foi possível remover.');
  } catch {
    return { ok: false, erro: 'Não foi possível remover.' };
  }
}

export async function trocarSenhaUsuario(token: string, id: string, senha: string): Promise<AcaoResultado> {
  try {
    const { data, error } = await supabase.rpc('trocar_senha_usuario_revenda', {
      p_token: token, p_id: id, p_senha: senha,
    });
    return resultado(data, error, 'Não foi possível trocar a senha.');
  } catch {
    return { ok: false, erro: 'Não foi possível trocar a senha.' };
  }
}
