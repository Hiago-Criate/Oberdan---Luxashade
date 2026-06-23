// Identificação da revenda (cliente) pelo CNPJ, via RPC get_revenda_by_cnpj
// (anon). Usado no início do pedido: aplica o desconto cadastrado e preenche os
// dados do cliente no orçamento/PDF. Sem match → null → cálculo normal.

import { supabase } from '../lib/supabase';

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

export async function fetchRevendaByCnpj(cnpj: string): Promise<Revenda | null> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!digits) return null;
  try {
    const { data, error } = await supabase.rpc('get_revenda_by_cnpj', { p_cnpj: digits });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return null;
    return {
      nome: row.nome ?? '',
      desconto: Number(row.desconto) || 0,
      acesso: row.acesso ?? 'AMBOS',
      vendedor: row.vendedor ?? null,
      codVendedor: row.cod_vendedor ?? null,
      telefone: row.telefone ?? null,
      codigo: row.codigo ?? null,
      loja: row.loja ?? null,
      filial: row.filial ?? null,
    };
  } catch {
    return null; // banco indisponível / RPC ausente → segue sem desconto
  }
}
