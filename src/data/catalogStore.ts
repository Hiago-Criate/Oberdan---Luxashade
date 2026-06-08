// Fonte de dados ativa do app. No boot, tenta carregar o catálogo do Supabase
// (get_catalog). Se falhar, mantém o catálogo ESTÁTICO embutido como fallback —
// o app continua funcionando offline / sem banco.
//
// Sem dependências circulares: este módulo importa apenas dados PUROS
// (shadeCatalog, shadeModelLimits) e o client do Supabase. Os módulos de lógica
// (shadeQueries, calculatorShade, calculator, sxpOpcionais, motorPrices, brands)
// importam DESTE módulo — nunca o contrário.

import {
  FAMILIAS, ACIONAMENTOS, MODELOS, TIPOS_TECIDO, COLECOES, CORES_TECIDO, CORES_ACAB, ROWS,
} from './shadeCatalog';
import { SHADE_MODEL_LIMITS, type ModelLimits } from './shadeModelLimits';
import { supabase } from '../lib/supabase';

export type EstoqueStatus = 'disponivel' | 'sob_consulta' | 'indisponivel';

export interface Product {
  familia: string;
  acionamento: string;
  modelo: string;
  tipo: string;
  colecao: string;
  corTecido: string;
  corAcab: string;
  vlrM2: number;
  codigo: string;
}

export interface RemoteOpcional {
  codigo: string;
  descricao: string;
  valor: number;
  formula: 'fixo' | 'porLargura' | 'porAltura' | 'porAltComando';
  obs?: string | null;
  exclui?: string[];
}

export interface RemoteCatalog {
  familias: { nome: string; marca: string; display: string | null }[];
  acionamentos: string[];
  modelos: { nome: string; familia: string | null }[];
  tipos: string[];
  colecoes: { nome: string; tipo: string | null; estoque: EstoqueStatus }[];
  coresTecido: { nome: string; estoque: EstoqueStatus }[];
  coresAcab: { codigo: string; nome: string; hex: string | null }[];
  products: Product[];
  limites: Record<string, ModelLimits>;
  motores: { nome: string; branco: number; preto: number; uso_trilho: boolean; uso_shade: boolean; informativo: boolean }[];
  trilhoModelos: { codigo: string; nome: string }[];
  trilhoProdutos: { codigo: string; modelo_codigo: string; descricao: string; cor: string; abertura: string; componentes: { c: string; q: number; f: string; v: number }[] }[];
  opcionaisPorModelo: Record<string, RemoteOpcional[]>;
  opcionaisControle: RemoteOpcional[];
  estoqueCombo: { colecao: string; cor: string; estoque: EstoqueStatus }[];
  config: Record<string, any>;
}

// ---------- Fallback estático ----------
const normAcab = (c: string): string =>
  (({ '1': '01', '2': '02', '3': '03', '5': '05' } as Record<string, string>)[c] ?? c);

const STATIC_PRODUCTS: Product[] = ROWS.map((r) => ({
  familia: FAMILIAS[r[0] as number],
  acionamento: ACIONAMENTOS[r[1] as number],
  modelo: MODELOS[r[2] as number],
  tipo: TIPOS_TECIDO[r[3] as number],
  colecao: COLECOES[r[4] as number],
  corTecido: CORES_TECIDO[r[5] as number],
  corAcab: normAcab(CORES_ACAB[r[6] as number]),
  vlrM2: r[7] as number,
  codigo: r[8] as string,
}));

const STATIC_CORES_ACAB = ['01', '02', '03', '05'];

// ---------- Estado ----------
let remote: RemoteCatalog | null = null;

export function getRemote(): RemoteCatalog | null { return remote; }
export function isRemote(): boolean { return !!remote; }
export function catalogSource(): 'remote' | 'static' { return remote ? 'remote' : 'static'; }
export function setRemote(c: RemoteCatalog | null) { remote = c; }

// ---------- Acessores usados pelos módulos de lógica ----------
export function activeProducts(): Product[] {
  return remote ? remote.products : STATIC_PRODUCTS;
}

export function activeLimits(): Record<string, ModelLimits> {
  return remote ? remote.limites : SHADE_MODEL_LIMITS;
}

export function familiasList(): string[] {
  return remote ? remote.familias.map((f) => f.nome) : [...FAMILIAS];
}
export function acionamentosList(): string[] {
  return remote ? remote.acionamentos : [...ACIONAMENTOS];
}
export function modelosList(): string[] {
  return remote ? remote.modelos.map((m) => m.nome) : [...MODELOS];
}
export function tiposList(): string[] {
  return remote ? remote.tipos : [...TIPOS_TECIDO];
}
export function colecoesList(): string[] {
  return remote ? remote.colecoes.map((c) => c.nome) : [...COLECOES];
}
export function coresTecidoList(): string[] {
  return remote ? remote.coresTecido.map((c) => c.nome) : [...CORES_TECIDO];
}
export function coresAcabList(): string[] {
  return remote ? remote.coresAcab.map((c) => c.codigo) : [...STATIC_CORES_ACAB];
}

// Ordena `values` (únicos) conforme a ordem em `dict`; desconhecidos vão ao fim.
export function orderByDict(values: Iterable<string>, dict: string[]): string[] {
  const uniq = Array.from(new Set(values));
  const idx = new Map(dict.map((v, i) => [v, i]));
  return uniq.sort((a, b) => (idx.get(a) ?? 1e9) - (idx.get(b) ?? 1e9));
}

// ---------- Estoque (Sob Consulta) ----------
export function estoqueColecaoMap(): Record<string, EstoqueStatus> {
  const out: Record<string, EstoqueStatus> = {};
  if (remote) for (const c of remote.colecoes) out[c.nome] = c.estoque;
  return out;
}
export function estoqueCorMap(): Record<string, EstoqueStatus> {
  const out: Record<string, EstoqueStatus> = {};
  if (remote) for (const c of remote.coresTecido) out[c.nome] = c.estoque;
  return out;
}

// ---------- Hidratação ----------
export async function hydrateCatalog(): Promise<'remote' | 'static'> {
  try {
    const { data, error } = await supabase.rpc('get_catalog');
    if (error || !data) throw error || new Error('catálogo vazio');
    const j = data as any;
    remote = {
      familias: j.familias ?? [],
      acionamentos: j.acionamentos ?? [],
      modelos: j.modelos ?? [],
      tipos: j.tipos_tecido ?? [],
      colecoes: j.colecoes ?? [],
      coresTecido: j.cores_tecido ?? [],
      coresAcab: j.cores_acab ?? [],
      products: (j.produtos ?? []).map((p: any[]) => ({
        familia: p[0], acionamento: p[1], modelo: p[2], tipo: p[3],
        colecao: p[4], corTecido: p[5], corAcab: p[6], vlrM2: Number(p[7]), codigo: p[8],
      })),
      limites: j.limites ?? {},
      motores: j.motores ?? [],
      trilhoModelos: j.trilho_modelos ?? [],
      trilhoProdutos: j.trilho_produtos ?? [],
      opcionaisPorModelo: j.opcionais_por_modelo ?? {},
      opcionaisControle: j.opcionais_controle ?? [],
      estoqueCombo: j.estoque_combo ?? [],
      config: j.config ?? {},
    };
    return 'remote';
  } catch (e) {
    console.warn('[catalog] Supabase indisponível — usando catálogo estático.', e);
    remote = null;
    return 'static';
  }
}
