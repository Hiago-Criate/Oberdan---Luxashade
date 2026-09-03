// Histórico de pedidos/orçamentos por CNPJ (revenda). Persistido no Supabase via
// RPCs SECURITY DEFINER (salvar_pedido / listar_pedidos_by_cnpj / excluir_pedido)
// — o app anônimo só enxerga os pedidos do CNPJ informado. Tudo é best-effort:
// se a tabela/RPC ainda não existir ou o banco cair, as funções degradam sem
// quebrar o fluxo do pedido (salvar→null, listar→[], excluir→false).
//
// A tabela é criada por `sql/pedidos.sql` (rodar no SQL Editor do Supabase).
//
// Com LOGIN ativo na revenda (ver `sql/usuarios_revenda.sql`), passamos o token
// da sessão e o banco decide o alcance: ADMIN da revenda enxerga os pedidos de
// todos os vendedores, VENDEDOR enxerga só os dele. Sem token (revenda que ainda
// não usa login) segue o comportamento antigo, por CNPJ.

import { supabase } from '../lib/supabase';
import type { OrderItem } from '../types/order';
import type { Brand } from './brands';
import type { Revenda } from './revenda';

export interface PedidoSalvo {
  id: string;
  marca: Brand;
  tipo: 'orcamento' | 'pedido';
  numero: string | null;
  clienteNome: string | null;
  clienteFone: string | null;
  itens: OrderItem[];
  subtotal: number;
  descontoPct: number;
  descontoValor: number;
  total: number;
  revenda: Revenda | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Quem criou (só vem quando a revenda usa login). */
  autor?: string | null;
  /** true quando o pedido é do usuário logado. */
  meu?: boolean;
}

export interface SalvarPedidoInput {
  id?: string | null; // se presente, atualiza o pedido existente (upsert)
  cnpj: string;
  marca: Brand;
  tipo: 'orcamento' | 'pedido';
  numero: string;
  clienteNome: string;
  clienteFone: string;
  itens: OrderItem[];
  subtotal: number;
  descontoPct: number;
  descontoValor: number;
  total: number;
  revenda: Revenda | null;
}

// Resultado do salvamento. O ENVIO depende disto: se o banco recusar (papel
// errado, sessão expirada) ou cair, NADA é disparado no WhatsApp. Antes o erro
// virava `null` silencioso e o pedido seguia para a fábrica assim mesmo.
export interface SalvarResultado {
  ok: boolean;
  id?: string;
  erro?: string;
  sessaoMorta?: boolean;   // precisa fazer login de novo
}

// Traduz a recusa do banco para uma frase que a pessoa entende.
function motivoDoBanco(error: any): SalvarResultado {
  const msg = String(error?.message || '');
  if (msg.includes('somente o administrador')) {
    return { ok: false, erro: 'Só o administrador da revenda pode gerar pedido de fábrica. Você pode gerar orçamento.' };
  }
  if (msg.includes('sessao invalida') || msg.includes('usa login')) {
    return { ok: false, sessaoMorta: true, erro: 'Sua sessão expirou. Entre de novo para continuar.' };
  }
  return { ok: false, erro: 'Não conseguimos registrar agora. Confira a internet e tente de novo.' };
}

// Salva/atualiza um pedido no histórico.
export async function salvarPedido(input: SalvarPedidoInput, token?: string | null): Promise<SalvarResultado> {
  const digits = (input.cnpj || '').replace(/\D/g, '');
  if (!digits) return { ok: false, erro: 'CNPJ não identificado.' };
  if (token) {
    try {
      const { data, error } = await supabase.rpc('salvar_pedido_sessao', {
        p_token: token,
        p_id: input.id ?? null,
        p_marca: input.marca,
        p_tipo: input.tipo,
        p_numero: input.numero,
        p_cliente_nome: input.clienteNome,
        p_cliente_fone: input.clienteFone,
        p_itens: input.itens,
        p_subtotal: input.subtotal,
        p_desconto_pct: input.descontoPct,
        p_desconto_valor: input.descontoValor,
        p_total: input.total,
        p_revenda: input.revenda,
      });
      if (error) return motivoDoBanco(error);
      return typeof data === 'string'
        ? { ok: true, id: data }
        : { ok: false, erro: 'Não conseguimos registrar agora. Tente de novo.' };
    } catch (e) {
      return motivoDoBanco(e);
    }
  }
  try {
    const { data, error } = await supabase.rpc('salvar_pedido', {
      p_id: input.id ?? null,
      p_cnpj: digits,
      p_marca: input.marca,
      p_tipo: input.tipo,
      p_numero: input.numero,
      p_cliente_nome: input.clienteNome,
      p_cliente_fone: input.clienteFone,
      p_itens: input.itens,
      p_subtotal: input.subtotal,
      p_desconto_pct: input.descontoPct,
      p_desconto_valor: input.descontoValor,
      p_total: input.total,
      p_revenda: input.revenda,
    });
    if (error) return motivoDoBanco(error);
    return typeof data === 'string'
      ? { ok: true, id: data }
      : { ok: false, erro: 'Não conseguimos registrar agora. Tente de novo.' };
  } catch (e) {
    return motivoDoBanco(e);
  }
}

// Lista os pedidos visíveis (mais recentes primeiro). [] em qualquer falha.
// Com token: admin vê os de toda a revenda, vendedor vê só os dele.
export async function listarPedidos(cnpj: string, token?: string | null): Promise<PedidoSalvo[]> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (token) {
    try {
      const { data, error } = await supabase.rpc('listar_pedidos_sessao', { p_token: token });
      if (error || !Array.isArray(data)) return [];
      return data.map(mapRow);
    } catch {
      return [];
    }
  }
  if (!digits) return [];
  try {
    const { data, error } = await supabase.rpc('listar_pedidos_by_cnpj', { p_cnpj: digits });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapRow);
  } catch {
    return [];
  }
}

// Exclui um pedido do histórico. true se removeu.
export async function excluirPedido(id: string, cnpj: string, token?: string | null): Promise<boolean> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!id) return false;
  if (token) {
    try {
      const { data, error } = await supabase.rpc('excluir_pedido_sessao', { p_token: token, p_id: id });
      return !error && data === true;
    } catch {
      return false;
    }
  }
  if (!digits) return false;
  try {
    const { data, error } = await supabase.rpc('excluir_pedido', { p_id: id, p_cnpj: digits });
    return !error && data === true;
  } catch {
    return false;
  }
}

function mapRow(r: Record<string, unknown>): PedidoSalvo {
  return {
    id: String(r.id),
    marca: (r.marca as Brand) ?? 'luxashade',
    tipo: (r.tipo as 'orcamento' | 'pedido') ?? 'orcamento',
    numero: (r.numero as string) ?? null,
    clienteNome: (r.cliente_nome as string) ?? null,
    clienteFone: (r.cliente_fone as string) ?? null,
    itens: Array.isArray(r.itens) ? (r.itens as OrderItem[]) : [],
    subtotal: Number(r.subtotal) || 0,
    descontoPct: Number(r.desconto_pct) || 0,
    descontoValor: Number(r.desconto_valor) || 0,
    total: Number(r.total) || 0,
    revenda: (r.revenda as Revenda | null) ?? null,
    criadoEm: String(r.criado_em ?? ''),
    atualizadoEm: String(r.atualizado_em ?? ''),
    autor: (r.autor as string) ?? null,
    meu: r.meu === undefined ? undefined : r.meu === true,
  };
}
