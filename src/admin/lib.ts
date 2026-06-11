// Apoio do painel /admin: autenticação, helpers de dados e formatação.
import { supabase } from '../lib/supabase';

export type Marca = 'luxashade' | 'shadexp';
export type EstoqueStatus = 'disponivel' | 'sob_consulta' | 'indisponivel';

export const ESTOQUE_LABEL: Record<EstoqueStatus, string> = {
  disponivel: 'Disponível',
  sob_consulta: 'Sob Consulta',
  indisponivel: 'Em falta',
};

export const money = (n: number | string) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const intBR = (n: number | string) => (Number(n) || 0).toLocaleString('pt-BR');

// ---- Auth ----
export async function login(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function logout() {
  return supabase.auth.signOut();
}

// ---- CRUD genérico ----
export async function fetchAll<T = any>(
  table: string,
  opts?: { order?: { col: string; asc?: boolean }; cols?: string },
): Promise<T[]> {
  let q = supabase.from(table).select(opts?.cols ?? '*');
  if (opts?.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? true });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function updateRow(table: string, id: number | string, values: Record<string, any>, pk = 'id') {
  const { error } = await supabase.from(table).update(values).eq(pk, id);
  if (error) throw error;
}

export async function insertRow(table: string, values: Record<string, any>) {
  const { data, error } = await supabase.from(table).insert(values).select();
  if (error) throw error;
  return data?.[0];
}

export async function deleteRow(table: string, id: number | string, pk = 'id') {
  const { error } = await supabase.from(table).delete().eq(pk, id);
  if (error) throw error;
}

// produtos por família (com filtros) — evita carregar 8015 de uma vez
export async function fetchProdutos(filtros: {
  familia: string; modelo?: string; tipo?: string; limit?: number;
}) {
  let q = supabase
    .from('produtos')
    .select('id, familia, acionamento, modelo, tipo_tecido, colecao, cor_tecido, cor_acab, vlr_m2, codigo, ativo, larg_max')
    .eq('familia', filtros.familia)
    .order('modelo')
    .order('colecao')
    .order('cor_tecido')
    .limit(filtros.limit ?? 2000);
  if (filtros.modelo) q = q.eq('modelo', filtros.modelo);
  if (filtros.tipo) q = q.eq('tipo_tecido', filtros.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// distinct helper a partir de produtos (para filtros de modelo/coleção/cor por marca)
export async function distinctFrom(col: string, where: Record<string, any>): Promise<string[]> {
  let q = supabase.from('produtos').select(col);
  for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
  const { data, error } = await q.limit(20000);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) set.add((r as any)[col]);
  return Array.from(set).sort();
}
