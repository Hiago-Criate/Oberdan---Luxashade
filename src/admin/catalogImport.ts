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
// Trilho motorizado (BOM): 1 código (255.xx) -> lista de componentes cobrados.
// v (valor unitário de venda) = PRECO MP × markup de cor (1,1 branco / 1,2 preto).
export interface TrilhoComp { c: string; q: number; f: string; v: number }
export interface TrilhoRow { codigo: string; componentes: TrilhoComp[] }
// Curvas e motores do trilho (aba ACESSORIOS-TRILHOS-255): preço direto de venda.
export interface TrilhoCurvaRow { codigo: string; valor: number }
export interface TrilhoMotorRow { nome: string; valor: number }
export interface ParsedCatalog {
  sheetNames: string[];
  dims: DimRow[];
  prices: PriceRow[];
  trilho: TrilhoRow[];
  trilhoCurvas: TrilhoCurvaRow[];
  trilhoMotores: TrilhoMotorRow[];
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

// ---------- trilho: fórmulas + preço (ESPELHA calculator.ts) ----------
// Conjunto de fórmulas que o motor de cálculo do trilho entende. Se a planilha
// trouxer uma fórmula fora desta lista, o preço não sairia certo -> vira aviso.
const TRILHO_FORMULAS = new Set<string>([
  '', '(AA$1*2)/1000', '(AA$1*2.4)/1000', '(AA$1*2.6)/1000', '(AA$1*3.4)/1000',
  '(AA$1*1.8)/1000', '(AA$1+150)/1000', '(AA$1-100)/1000',
  'ARREDONDAR.PARA.CIMA(AA$1/100)', 'ARREDONDAR.PARA.CIMA(AA$1/100)+8',
  'ARREDONDAR.PARA.CIMA(AA$1/48)+2', 'ARREDONDAR.PARA.CIMA(AA$1/60)',
  'ARREDONDAR.PARA.CIMA(AA$1/60)+2', 'ARREDONDAR.PARA.CIMA(AA$1/60)+8',
  'ARREDONDAR.PARA.CIMA(AA$1/67)+2', 'ARREDONDAR.PARA.CIMA(AA$1/600)',
  'INT(AA$1/6001)',
]);
// markup pela cor do código: ….01x = branco (1,1) ; ….05x = preto (1,2).
const trilhoMarkup = (codigo: string) => ((codigo.split('.').pop() ?? '').startsWith('05') ? 1.2 : 1.1);
const trilhoFKey = (f: string) => (f || '').replace(/\s/g, '').toUpperCase();
// Avaliador de quantidade — igual a calcularQuantidade() do calculator.ts.
function trilhoQtd(f: string, L: number, qb: number): number {
  switch (f) {
    case '(AA$1*2)/1000': return (L * 2) / 1000;
    case '(AA$1*2.4)/1000': return (L * 2.4) / 1000;
    case '(AA$1*2.6)/1000': return (L * 2.6) / 1000;
    case '(AA$1*3.4)/1000': return (L * 3.4) / 1000;
    case '(AA$1*1.8)/1000': return (L * 1.8) / 1000;
    case '(AA$1+150)/1000': return (L + 150) / 1000;
    case '(AA$1-100)/1000': return (L - 100) / 1000;
    case 'ARREDONDAR.PARA.CIMA(AA$1/100)': return Math.ceil(L / 100);
    case 'ARREDONDAR.PARA.CIMA(AA$1/100)+8': return Math.ceil(L / 100) + 8;
    case 'ARREDONDAR.PARA.CIMA(AA$1/48)+2': return Math.ceil(L / 48) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)': return Math.ceil(L / 60);
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)+2': return Math.ceil(L / 60) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)+8': return Math.ceil(L / 60) + 8;
    case 'ARREDONDAR.PARA.CIMA(AA$1/67)+2': return Math.ceil(L / 67) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/600)': return Math.ceil(L / 600);
    case 'INT(AA$1/6001)': return Math.floor(L / 6001);
    default: return qb;
  }
}
// Preço-base do trilho (antes do motor/curva) numa largura — só p/ PREVIEW do diff.
const TRILHO_REF_W = 3000;
const trilhoBase = (comps: TrilhoComp[], L: number) =>
  comps.reduce((t, c) => t + c.v * (c.f ? trilhoQtd(c.f, L, c.q) : c.q), 0);
// true se as duas listas de componentes diferem (estrutura ou valor > meio centavo).
function trilhoChanged(cur: TrilhoComp[], next: TrilhoComp[]): boolean {
  if (cur.length !== next.length) return true;
  const m = new Map(cur.map((c) => [`${c.c}|${c.q}|${trilhoFKey(c.f)}`, c.v]));
  for (const c of next) {
    const v = m.get(`${c.c}|${c.q}|${trilhoFKey(c.f)}`);
    if (v == null || Math.abs(v - c.v) > 0.005) return true;
  }
  return false;
}

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

// Aba do trilho (BOM): "SG1 - ATUALIZADA". Cabeçalho não está na 1ª linha, então
// procuramos a linha que tem G1_COD + G1_COMP + PRECO MP. Só componentes SNS são
// cobrados (SNN = incluso, R$ 0). v = PRECO MP × markup de cor.
function parseTrilho(sheets: Sheet[], warnings: string[]): TrilhoRow[] {
  for (const sh of sheets) {
    let hi = -1;
    for (let i = 0; i < Math.min(sh.rows.length, 8); i++) {
      const keys = new Set((sh.rows[i] ?? []).map(norm));
      if (keys.has('g1_cod') && keys.has('g1_comp') && keys.has('preco mp')) { hi = i; break; }
    }
    if (hi < 0) continue;
    const get = colMap(sh.rows[hi]);
    const cCod = get('g1_cod'), cComp = get('g1_comp'), cQ = get('g1_quant'),
      cF = get('g1_xformul'), cPad = get('padrao'), cPreco = get('preco mp');
    const byCode = new Map<string, TrilhoComp[]>();
    for (const r of sh.rows.slice(hi + 1)) {
      const codigo = s(r[cCod]); if (!codigo) continue;
      if (s(r[cPad]).toUpperCase() !== 'SNS') continue; // SNN = não cobrado
      const f = s(r[cF]);
      if (!TRILHO_FORMULAS.has(f))
        warnings.push(`Trilho ${codigo}: fórmula não reconhecida "${f}" (comp. ${s(r[cComp])}).`);
      const comp: TrilhoComp = {
        c: s(r[cComp]), q: n(r[cQ]) ?? 1, f,
        v: Math.round((n(r[cPreco]) ?? 0) * trilhoMarkup(codigo) * 1e6) / 1e6,
      };
      (byCode.get(codigo) ?? byCode.set(codigo, []).get(codigo)!).push(comp);
    }
    return Array.from(byCode, ([codigo, componentes]) => ({ codigo, componentes }));
  }
  return [];
}

// Aba ACESSORIOS-TRILHOS-255: preço de venda dos motores e das curvas do trilho.
// Cabeçalho: Cod | Descricao PA | Comp | Componente | Preco Venda | ... | Cor PA.
// (distinguir da MARCA_E_GRUPO, que tem 'Marca' e não tem 'Cod'/'Cor PA'.)
const CURVA_CODES = new Set(['154.27.00', '154.28.00', '154.29.00', '154.30.00']);
function parseTrilhoAcessorios(sheets: Sheet[]): { curvas: TrilhoCurvaRow[]; motores: TrilhoMotorRow[] } {
  for (const sh of sheets) {
    if (!sh.rows.length) continue;
    const keys = new Set(sh.rows[0].map(norm));
    if (!(keys.has('cod') && keys.has('comp') && keys.has('preco venda') && keys.has('cor pa'))) continue;
    const get = colMap(sh.rows[0]);
    const cComp = get('comp'), cNome = get('componente'), cPreco = get('preco venda');
    const curvas: TrilhoCurvaRow[] = [], motores: TrilhoMotorRow[] = [];
    const seenC = new Set<string>(), seenM = new Set<string>();
    for (const r of sh.rows.slice(1)) {
      const comp = s(r[cComp]); const preco = n(r[cPreco]); if (!comp || preco == null) continue;
      if (CURVA_CODES.has(comp)) {
        if (!seenC.has(comp)) { seenC.add(comp); curvas.push({ codigo: comp, valor: preco }); }
      } else {
        const nome = s(r[cNome]);
        // só motores "de verdade" (exclui SEM MOTOR informativo, preço-placebo 0,01)
        if (/^MOTOR /i.test(nome) && !seenM.has(nome)) { seenM.add(nome); motores.push({ nome, valor: preco }); }
      }
    }
    return { curvas, motores };
  }
  return { curvas: [], motores: [] };
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

  const trilho = parseTrilho(sheets, warnings);
  const { curvas: trilhoCurvas, motores: trilhoMotores } = parseTrilhoAcessorios(sheets);

  if (!dims.length) warnings.push('Aba de dimensões (GR_MIN_MAX) não encontrada.');
  if (!prices.length) warnings.push('Aba de preços (PA x Regras M²) não encontrada.');
  if (!trilho.length) warnings.push('Aba do trilho (SG1 - ATUALIZADA) não encontrada.');

  // larg máx do grupo + override por tecido (tecido < grupo)
  const grpLargMax: Record<string, number> = {};
  for (const d of dims) if (d.larg_max != null) grpLargMax[d.grupo] = d.larg_max;
  for (const p of prices) {
    const raw = (p as any)._lmaxRaw as number | null;
    const gmax = grpLargMax[p.grupo];
    p.largMaxOverride = raw != null && gmax != null && raw < gmax ? raw : null;
    delete (p as any)._lmaxRaw;
  }

  return { sheetNames: sheets.map((x) => x.name), dims, prices, trilho, trilhoCurvas, trilhoMotores, grpLargMax, warnings };
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
  trilho: { bomTotal: number; bomChanged: number; curvasChanged: number; motoresChanged: number; changed: number; unmatched: number; samples: string[] };
  grupoNome: Record<string, string>;
}

// Componentes de trilho atuais no banco, agrupados por código.
async function fetchTrilhoComponentes(): Promise<Map<string, TrilhoComp[]>> {
  const { data } = await supabase
    .from('trilho_componentes')
    .select('trilho_codigo, comp_codigo, quantidade, formula, valor');
  const out = new Map<string, TrilhoComp[]>();
  for (const r of (data ?? []) as any[]) {
    const arr = out.get(r.trilho_codigo) ?? out.set(r.trilho_codigo, []).get(r.trilho_codigo)!;
    arr.push({ c: r.comp_codigo, q: Number(r.quantidade), f: r.formula ?? '', v: Number(r.valor) });
  }
  return out;
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

  // trilho (BOM)
  const curTril = await fetchTrilhoComponentes();
  const trilhoSamples: string[] = [];
  let bomChanged = 0, trilhoUnmatched = 0;
  for (const t of parsed.trilho) {
    const cur = curTril.get(t.codigo);
    if (!cur) { trilhoUnmatched++; continue; }
    if (trilhoChanged(cur, t.componentes)) {
      bomChanged++;
      if (trilhoSamples.length < 12)
        trilhoSamples.push(`${t.codigo}: R$${trilhoBase(cur, TRILHO_REF_W).toFixed(2)}→R$${trilhoBase(t.componentes, TRILHO_REF_W).toFixed(2)} (base ${TRILHO_REF_W / 1000}m)`);
    }
  }
  // curvas do trilho (valor direto, casa por código)
  let curvasChanged = 0;
  if (parsed.trilhoCurvas.length) {
    const { data } = await supabase.from('trilho_curvas').select('codigo, valor');
    const cur = new Map((data ?? []).map((r: any) => [r.codigo, Number(r.valor)]));
    for (const c of parsed.trilhoCurvas) {
      const v = cur.get(c.codigo);
      if (v == null || Math.abs(v - c.valor) > 0.005) {
        curvasChanged++;
        if (trilhoSamples.length < 16) trilhoSamples.push(`curva ${c.codigo}: R$${(v ?? 0).toFixed(2)}→R$${c.valor.toFixed(2)}`);
      }
    }
  }
  // motores do trilho (casa por NOME; só os marcados uso_trilho no banco)
  let motoresChanged = 0;
  if (parsed.trilhoMotores.length) {
    const { data } = await supabase.from('motores').select('nome, preco_branco, preco_preto, uso_trilho');
    const cur = new Map((data ?? []).filter((m: any) => m.uso_trilho).map((m: any) => [m.nome as string, m]));
    for (const mo of parsed.trilhoMotores) {
      const db: any = cur.get(mo.nome);
      if (!db) continue; // motor da planilha não está como trilho no banco -> ignora
      if (Math.abs(Number(db.preco_branco) - mo.valor) > 0.005 || Math.abs(Number(db.preco_preto) - mo.valor) > 0.005) {
        motoresChanged++;
        if (trilhoSamples.length < 16) trilhoSamples.push(`motor ${mo.nome}: R$${Number(db.preco_branco).toFixed(2)}→R$${mo.valor.toFixed(2)}`);
      }
    }
  }

  return {
    dims: { total: parsed.dims.length, changed: dimChanged, samples: dimSamples },
    prices: { combos: parsed.prices.length, combosChanged, productsChanged, samples: priceSamples, unmatched },
    largMax: { combos: largCombosChanged, productsAffected: largProducts, samples: largSamples },
    trilho: {
      bomTotal: parsed.trilho.length, bomChanged, curvasChanged, motoresChanged,
      changed: bomChanged + curvasChanged + motoresChanged, unmatched: trilhoUnmatched, samples: trilhoSamples,
    },
    grupoNome,
  };
}

// ---------- aplicar ----------
async function pool<T>(items: T[], worker: (t: T) => Promise<void>, concurrency: number, onTick?: () => void) {
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; await worker(items[idx]); onTick?.(); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export interface ApplyResult { dimsUpdated: number; combosUpdated: number; productsTouched: number; trilhosUpdated: number; curvasUpdated: number; motoresUpdated: number; fails: number; failSamples: string[]; }

export async function applyImport(
  parsed: ParsedCatalog,
  grupoNome: Record<string, string>,
  onProgress?: (done: number, total: number) => void,
): Promise<ApplyResult> {
  const res: ApplyResult = { dimsUpdated: 0, combosUpdated: 0, productsTouched: 0, trilhosUpdated: 0, curvasUpdated: 0, motoresUpdated: 0, fails: 0, failSamples: [] };
  const total = parsed.dims.length + parsed.prices.length + parsed.trilho.length + parsed.trilhoCurvas.length + parsed.trilhoMotores.length;
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

  // 3) trilho (BOM): regrava os componentes dos códigos que mudaram (delete+insert).
  if (parsed.trilho.length) {
    const cur = await fetchTrilhoComponentes();
    for (const t of parsed.trilho) {
      const before = cur.get(t.codigo);
      if (!before || !trilhoChanged(before, t.componentes)) { tick(); continue; } // inexistente ou igual
      const del = await supabase.from('trilho_componentes').delete().eq('trilho_codigo', t.codigo);
      if (del.error) {
        res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`trilho ${t.codigo}: ${del.error.message}`);
        tick(); continue;
      }
      const rows = t.componentes.map((c, i) => ({
        trilho_codigo: t.codigo, comp_codigo: c.c, quantidade: c.q, formula: c.f, valor: c.v, ordem: i,
      }));
      const ins = await supabase.from('trilho_componentes').insert(rows);
      if (ins.error) { res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`trilho ${t.codigo}: ${ins.error.message}`); }
      else res.trilhosUpdated++;
      tick();
    }
  }

  // 4) curvas do trilho: atualiza o valor dos códigos que mudaram.
  if (parsed.trilhoCurvas.length) {
    const { data } = await supabase.from('trilho_curvas').select('codigo, valor');
    const cur = new Map((data ?? []).map((r: any) => [r.codigo, Number(r.valor)]));
    for (const c of parsed.trilhoCurvas) {
      const v = cur.get(c.codigo);
      if (v == null || Math.abs(v - c.valor) <= 0.005) { tick(); continue; }
      const { error } = await supabase.from('trilho_curvas').update({ valor: c.valor }).eq('codigo', c.codigo);
      if (error) { res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`curva ${c.codigo}: ${error.message}`); }
      else res.curvasUpdated++;
      tick();
    }
  }

  // 5) motores do trilho: atualiza branco+preto por NOME (só uso_trilho) que mudaram.
  if (parsed.trilhoMotores.length) {
    const { data } = await supabase.from('motores').select('nome, preco_branco, preco_preto, uso_trilho');
    const cur = new Map((data ?? []).filter((m: any) => m.uso_trilho).map((m: any) => [m.nome as string, m]));
    for (const mo of parsed.trilhoMotores) {
      const db: any = cur.get(mo.nome);
      if (!db || (Math.abs(Number(db.preco_branco) - mo.valor) <= 0.005 && Math.abs(Number(db.preco_preto) - mo.valor) <= 0.005)) { tick(); continue; }
      const { error } = await supabase.from('motores').update({ preco_branco: mo.valor, preco_preto: mo.valor }).eq('nome', mo.nome);
      if (error) { res.fails++; if (res.failSamples.length < 8) res.failSamples.push(`motor ${mo.nome}: ${error.message}`); }
      else res.motoresUpdated++;
      tick();
    }
  }

  return res;
}
