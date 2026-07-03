// Identificação da revenda (cliente) pelo CNPJ, via RPC get_revenda_by_cnpj
// (anon). No início do pedido: CONTROLA O ACESSO às marcas (campo `acesso`),
// aplica o desconto cadastrado e preenche os dados do cliente no orçamento/PDF.

import { supabase } from '../lib/supabase';
import type { Brand } from './brands';

export interface Revenda {
  nome: string;
  desconto: number; // percentual (ex.: 38 = 38%)
  acesso: string; // 'LUXA' | 'SXP' | 'AMBOS'
  vendedor: string | null;
  codVendedor: string | null;
  telefone: string | null;
  codigo: string | null;
  loja: string | null;
  filial: string | null;
}

// Resultado da identificação. Distingue "não cadastrado" (bloqueia o acesso) de
// "erro/indisponível" (NÃO bloqueia — falha técnica não é falta de autorização).
export type RevendaLookup =
  | { status: 'found'; revenda: Revenda }
  | { status: 'not_found'; revenda: null }
  | { status: 'error'; revenda: null };

function mapRow(row: Record<string, unknown>): Revenda {
  return {
    nome: (row.nome as string) ?? '',
    desconto: Number(row.desconto) || 0,
    acesso: (row.acesso as string) ?? 'AMBOS',
    vendedor: (row.vendedor as string) ?? null,
    codVendedor: (row.cod_vendedor as string) ?? null,
    telefone: (row.telefone as string) ?? null,
    codigo: (row.codigo as string) ?? null,
    loja: (row.loja as string) ?? null,
    filial: (row.filial as string) ?? null,
  };
}

// Identifica a revenda pelo CNPJ. Retorna o status para o app decidir o acesso.
export async function lookupRevendaByCnpj(cnpj: string): Promise<RevendaLookup> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!digits) return { status: 'not_found', revenda: null };
  try {
    const { data, error } = await supabase.rpc('get_revenda_by_cnpj', { p_cnpj: digits });
    if (error) return { status: 'error', revenda: null };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { status: 'not_found', revenda: null };
    return { status: 'found', revenda: mapRow(row) };
  } catch {
    return { status: 'error', revenda: null }; // banco indisponível / RPC ausente
  }
}

// Marcas que a revenda pode ver, a partir do campo `acesso`.
// 'LUXA' → só Luxashade; 'SXP' → só ShadeXP; qualquer outro ('AMBOS') → as duas.
export function allowedBrandsFor(acesso: string | null | undefined): Brand[] {
  const a = (acesso ?? 'AMBOS').toUpperCase();
  if (a === 'LUXA') return ['luxashade'];
  if (a === 'SXP') return ['shadexp'];
  return ['luxashade', 'shadexp'];
}
