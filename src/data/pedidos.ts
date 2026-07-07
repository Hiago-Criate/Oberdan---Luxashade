// Histórico de pedidos/orçamentos por CNPJ (revenda). Persistido no Supabase via
// RPCs SECURITY DEFINER (salvar_pedido / listar_pedidos_by_cnpj / excluir_pedido)
// — o app anônimo só enxerga os pedidos do CNPJ informado. Tudo é best-effort:
// se a tabela/RPC ainda não existir ou o banco cair, as funções degradam sem
// quebrar o fluxo do pedido (salvar→null, listar→[], excluir→false).
//
// A tabela é criada por `sql/pedidos.sql` (rodar no SQL Editor do Supabase).

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

// Salva/atualiza um pedido no histórico. Retorna o id salvo, ou null se falhar.
export async function salvarPedido(input: SalvarPedidoInput): Promise<string | null> {
  const digits = (input.cnpj || '').replace(/\D/g, '');
  if (!digits) return null;
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
    if (error) return null;
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

// Lista os pedidos do CNPJ (mais recentes primeiro). [] em qualquer falha.
export async function listarPedidos(cnpj: string): Promise<PedidoSalvo[]> {
  const digits = (cnpj || '').replace(/\D/g, '');
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
export async function excluirPedido(id: string, cnpj: string): Promise<boolean> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!id || !digits) return false;
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
  };
}
