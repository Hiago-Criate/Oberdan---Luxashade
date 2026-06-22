// ============================================================================
// Importador de catálogo a partir da planilha "Modelo Dados WebApp" (Lilia).
// Lê o .xlsx no navegador (SheetJS), detecta as abas por CONTEÚDO (robusto a
// renomear SG1/SZ1...), faz o DIFF contra o banco e aplica via Supabase.
//
// Escopo SEGURO (alta frequência de alteração):
//   • DIMENSÕES  (aba tipo GR_MIN_MAX) -> modelo_limites
//   • PREÇOS m²  (aba tipo PA x Regras M²) -> produtos.vlr_m2
//   • LARG. MÁX por tecido               -> produtos.larg_max (quando tecido < grupo)
//
// A chave de casamento é o CÓDIGO DO GRUPO (prefixo do produtos.codigo) + Cor PA,
// que casou 100% no import inicial — imune às divergências de nome do banco.
// ============================================================================
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export interface DimRow {
  grupo: string;
  larg_min: number | null; alt_min: number | null; m2_min: number | null;
  larg_max: number | null; alt_max: number | null; m2_max: number | null;
}
export interface PriceRow {
  grupo: string; corPA: string;
  vlr_m2: number | null; largMaxOverride: number | null;
  colecao: string; cor: string; tipo: string;
}
export interface ParsedCatalog {
  sheetNames: string[];
  dims: DimRow[];
  prices: PriceRow[];
  grpLargMax: Record<string, number>;
  warnings: string[];
}

// ---------- helpers ----------
const norm = (h: any) =>
  String(h ?? '').trim().toLowerCase().replace(/²/g, '2').replace(/\s+/g, ' ');
const s = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
};
const n = (v: any): number | null => {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// índice de cabeçalho -> coluna, tentando vários apelidos (normalizados)
function colMap(header: any[]): (...aliases: string[]) => number {
  const map = new Map<string, number>();
  header.forEach((h, i) => { const k = norm(h); if (!map.has(k)) map.set(k, i); });
  return (...aliases: string[]) => {
    for (const a of aliases) { const i = map.get(norm(a)); if (i != null) return i; }
    return -1;
  };
}

type Sheet = { name: string; rows: any[][] };

function readSheets(data: ArrayBuffer): Sheet[] {
  const wb = XLSX.read(data, { type: 'array' });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null }),
  }));
}

// ---------- parse ----------
export function parseWorkbook(data: ArrayBuffer): ParsedCatalog {
  const sheets = readSheets(data);
  const warnings: string[] = [];
  let dims: DimRow[] = [];
  let prices: PriceRow[] = [];

  for (const sh of sheets) {
    if (!sh.rows.length) continue;
    const header = sh.rows[0];
    const keys = new Set(header.map(norm));
    const get = colMap(header);

    const isDims = keys.has('gr') && keys.has('larg min') && keys.has('larg max') && keys.has('m2 max') && !keys.has('cor pa');
    const isPrices = keys.has('gr pa') && keys.has('cor pa') && (keys.has('vlr m2') || keys.has('vlrm2'));

    if (isDims) {
      const cG = get('gr'), cLmin = get('larg min'), cAmin = get('alt min'), cM2min = get('m2 min', 'm² min'),
        cLmax = get('larg max'), cAmax = get('alt max'), cM2max = get('m2 max', 'm² max');
      for (const r of sh.rows.slice(1)) {
        const grupo = s(r[cG]); if (!grupo) continue;
        dims.push({
          grupo, larg_min: n(r[cLmin]), alt_min: n(r[cAmin]), m2_min: n(r[cM2min]),
          larg_max: n(r[cLmax]), alt_max: n(r[cAmax]), m2_max: n(r[cM2max]),
        });
      }
    } else if (isPrices) {
      const cG = get('gr pa'), cCor = get('cor pa'), cVlr = get('vlr m2', 'vlrm2'),
        cLmax = get('larg max'), cCol = get('z2_desccol', 'colecao', 'coleção'),
        cCorN = get('z3_nomecor', 'cor'), cTipo = get('z2_tptecid', 'tipo');
      for (const r of sh.rows.slice(1)) {
        const grupo = s(r[cG]), corPA = s(r[cCor]);
        if (!grupo || !corPA) continue;
        prices.push({
          grupo, corPA, vlr_m2: n(r[cVlr]),
          largMaxOverride: null, // calculado abaixo com a largura do grupo
          colecao: s(r[cCol]), cor: s(r[cCorN]), tipo: s(r[cTipo]),
          // guarda a larg máx bruta temporariamente em alt:
          ...( { _lmaxRaw: n(r[cLmax]) } as any ),
        });
      }
    }
  }

  if (!dims.length) warnings.push('Aba de dimensões (GR_MIN_MAX) não encontrada.');
  if (!prices.length) warnings.push('Aba de preços (PA x Regras M²) não encontrada.');

  // larg máx do grupo + override por tecido (tecido < grupo)
  const grpLargMax: Record<string, number> = {};
  for (const d of dims) if (d.larg_max != null) grpLargMax[d.grupo] = d.larg_max;
  for (const p of prices) {
    const raw = (p as any)._lmaxRaw as number | null;
    const gmax = grpLargMax[p.grupo];
    p.largMaxOverride = raw != null && gmax != null && raw < gmax ? raw : null;
    delete (p as any)._lmaxRaw;
  }

  return { sheetNames: sheets.map((x) => x.name), dims, prices, grpLargMax, warnings };
}

// ---------- estado atual do banco ----------
async function fetchAllProdutos(): Promise<{ codigo: string; vlr_m2: number; larg_max: number | null; modelo: string }[]> {
  const out: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('produtos')
      .select('codigo, vlr_m2, larg_max, modelo')
      .range(start, start + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface CatalogDiff {
  dims: { total: number; changed: number; samples: string[] };
  prices: { combos: number; combosChanged: number; productsChanged: number; samples: string[]; unmatched: number };
  largMax: { combos: number; productsAffected: number; samples: string[] };
  grupoNome: Record<string, string>;
}

export async function diffAgainstDb(parsed: ParsedCatalog): Promise<CatalogDiff> {
  const produtos = await fetchAllProdutos();
  const grupoNome: Record<string, string> = {};
  const idx = new Map<string, { codigo: string; vlr_m2: number; larg_max: number | null }[]>();
  for (const p of produtos) {
    const parts = String(p.codigo).split('.');
    const g = parts[0];
    if (!(g in grupoNome)) grupoNome[g] = p.modelo;
    if (parts.length >= 3) {
      const k = `${parts[0]}|${parts[parts.length - 1]}`;
      (idx.get(k) ?? idx.set(k, []).get(k)!).push(p);
    }
  }

  const limites = await supabase.from('modelo_limites').select('modelo, larg_min, alt_min, m2_min, larg_max, alt_max, m2_max');
  const limByName = new Map<string, any>();
  for (const l of limites.data ?? []) limByName.set(l.modelo, l);

  // dims
  const dimSamples: string[] = []; let dimChanged = 0;
  for (const d of parsed.dims) {
    const name = grupoNome[d.grupo]; if (!name) continue;
    const cur = limByName.get(name); if (!cur) continue;
    const fields: [keyof DimRow, string][] = [['larg_min', 'larg_min'], ['alt_min', 'alt_min'], ['m2_min', 'm2_min'], ['larg_max', 'larg_max'], ['alt_max', 'alt_max'], ['m2_max', 'm2_max']];
    const diffs = fields.filter(([k, c]) => d[k] != null && Number(cur[c] ?? 0) !== Number(d[k]));
    if (diffs.length) {
      dimChanged++;
      if (dimSamples.length < 12) dimSamples.push(`${d.grupo} ${name}: ${diffs.map(([k]) => `${k} ${(limByName.get(name) as any)[k]}→${d[k]}`).join(', ')}`);
    }
  }

  // prices + larg_max
  const priceSamples: string[] = []; const largSamples: string[] = [];
  let combosChanged = 0, productsChanged = 0, unmatched = 0, largCombosChanged = 0, largProducts = 0;
  for (const p of parsed.prices) {
    const prods = idx.get(`${p.grupo}|${p.corPA}`);
    if (!prods) { unmatched++; continue; }
    if (p.vlr_m2 != null) {
      const ch = prods.filter((x) => Number(x.vlr_m2 ?? 0) !== p.vlr_m2);
      if (ch.length) {
        combosChanged++; productsChanged += ch.length;
        if (priceSamples.length < 12) priceSamples.push(`${p.grupo} ${p.colecao} ${p.cor}: R$${ch[0].vlr_m2}→R$${p.vlr_m2} [${ch.length}]`);
      }
    }
    // override de largura por tecido — conta set/alterar/limpar (target pode ser null)
    const target = p.largMaxOverride;
    const aff = prods.filter((x) => (x.larg_max ?? null) !== target);
    if (aff.length) {
      largCombosChanged++; largProducts += aff.length;
      if (target != null && largSamples.length < 10) largSamples.push(`${p.grupo} ${p.colecao} ${p.cor}: ${parsed.grpLargMax[p.grupo]}→${target}mm`);
    }
  }

  return {
    dims: { total: parsed.dims.length, changed: dimChanged, samples: dimSamples },
    prices: { combos: parsed.prices.length, combosChanged, productsChanged, samples: priceSamples, unmatched },
    largMax: { combos: largCombosChanged, productsAffected: largProducts, samples: largSamples },
    grupoNome,
  };
}

// ---------- aplicar ----------
async function pool<T>(items: T[], worker: (t: T) => Promise<void>, concurrency: number, onTick?: () => void) {
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; await worker(items[idx]); onTick?.(); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export interface ApplyResult { dimsUpdated: number; combosUpdated: number; productsTouched: number; fails: number; failSamples: string[]; }

export async function applyImport(
  parsed: ParsedCatalog,
  grupoNome: Record<string, string>,
  onProgress?: (done: number, total: number) => void,
): Promise<ApplyResult> {
  const res: ApplyResult = { dimsUpdated: 0, combosUpdated: 0, productsTouched: 0, fails: 0, failSamples: [] };
  const total = parsed.dims.length + parsed.prices.length;
  let done = 0;
  const tick = () => { done++; onProgress?.(done, total); };

  // 1) dimensões
  await pool(parsed.dims, async (d) => {
    const name = grupoNome[d.grupo];
    if (!name) { tick(); return; }
    const { error } = await supabase.from('modelo_limites').update({
      larg_min: d.larg_min, alt_min: d.alt_min, m2_min: d.m2_min,
      larg_max: d.larg_max, alt_max: d.alt_max, m2_max: d.m2_max,
    }).eq('modelo', name);
    if (error) { res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`dim ${d.grupo}: ${error.message}`); }
    else res.dimsUpdated++;
    tick();
  }, 6);

  // 2) preços + larg máx (PATCH por grupo.%.corPA)
  await pool(parsed.prices, async (p) => {
    const pattern = `${p.grupo}.%.${p.corPA}`;
    const { error, count } = await supabase
      .from('produtos')
      .update({ vlr_m2: p.vlr_m2, larg_max: p.largMaxOverride }, { count: 'exact' })
      .like('codigo', pattern);
    if (error) { res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`${pattern}: ${error.message}`); }
    else { res.combosUpdated++; res.productsTouched += count ?? 0; }
    tick();
  }, 8);

  return res;
}
