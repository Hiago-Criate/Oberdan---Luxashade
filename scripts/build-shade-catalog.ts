// Gera src/data/shadeCatalog.ts e src/data/shadeModelLimits.ts
// a partir da planilha pública do Google Sheets da Luxashade.
//
// Uso:  npm run build:shade-catalog
//
// O script é idempotente: sempre que a planilha mudar, rodar de novo
// e commitar a saída. Front nunca faz fetch em runtime.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHEET_ID = '1dRzc9MOjbUlz1hhGiJQ5K_u9okHPzP2HnjxvKTLmPm0';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const OUT_CATALOG = resolve(process.cwd(), 'src/data/shadeCatalog.ts');
const OUT_LIMITS = resolve(process.cwd(), 'src/data/shadeModelLimits.ts');

// Cabeçalhos da planilha vêm com prefixos numéricos e sufixos técnicos
// (ex.: "7 - Cor do Acabamento Car", "5 - Coleção Z2_DESCCOL").
// Em vez de exigir nome exato, usamos predicados que casam o trecho relevante.
type Field = keyof Row;
const COLUMN_MATCHERS: { field: Field; match: (h: string) => boolean }[] = [
  { field: 'cod',           match: (h) => /^cod prod\b/i.test(h) },
  { field: 'corAcabCod',    match: (h) => /cor do acabamento/i.test(h) },
  { field: 'colecao',       match: (h) => /coleção|colecao/i.test(h) },
  { field: 'corTecido',     match: (h) => /cor do tecido/i.test(h) },
  { field: 'acionamento',   match: (h) => /\bacionamento\b/i.test(h) && !/descricao/i.test(h) },
  { field: 'modelo',        match: (h) => /^descricao grupo$/i.test(h) },
  { field: 'familia',       match: (h) => /\bfamilia\b/i.test(h) },
  { field: 'vlrM2',         match: (h) => /vlr m²|vlr m2/i.test(h) },
  { field: 'largMin',       match: (h) => /^larg min\b/i.test(h) },
  { field: 'altMin',        match: (h) => /^alt min\b/i.test(h) },
  { field: 'm2Min',         match: (h) => /m² min|m2 min/i.test(h) },
  { field: 'largMax',       match: (h) => /larg max/i.test(h) },
  { field: 'altMax',        match: (h) => /alt max/i.test(h) },
  { field: 'm2Max',         match: (h) => /m² max|m2 max/i.test(h) },
];

type Row = {
  cod: string;
  corAcabCod: string;
  colecao: string;
  corTecido: string;
  acionamento: string;
  modelo: string;
  familia: string;
  vlrM2: number;
  largMin: number;
  altMin: number;
  m2Min: number;
  largMax: number;
  altMax: number;
  m2Max: number;
};

function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

function parseBRNumber(s: string): number {
  if (!s || !s.trim()) return 0;
  // "228,00" → 228.00, "1.234,56" → 1234.56
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function tipoTecidoFromColecao(colecao: string): string {
  // Sufixos conhecidos no nome da coleção (AMBAR TS 1%, DA VINCI BK, LIRIO TR).
  // Para coleções sem sufixo (BALLYS, BASIC, AURA 60MM…) usamos 'OUTROS'.
  const m = colecao.match(/\b(TS|BK|TR)\b/);
  if (m) {
    if (m[1] === 'TS') return 'Tela Solar';
    if (m[1] === 'BK') return 'Blackout';
    if (m[1] === 'TR') return 'Translucido';
  }
  return 'Outros';
}

// Renomeações comerciais de coleções aplicadas na geração do catálogo.
const COLECAO_RENAMES: Record<string, string> = {
  'DAY NIGHT': 'DAY NIGHT RIOJA TR + BK',
};

function normalizeColecao(colecao: string): string {
  return COLECAO_RENAMES[colecao] ?? colecao;
}

async function main() {
  process.stdout.write(`> Baixando planilha de ${CSV_URL}\n`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar CSV`);
  const csv = await res.text();
  const matrix = parseCSV(csv);
  if (matrix.length < 2) throw new Error('CSV vazio ou inválido');

  const header = matrix[0].map((h) => h.trim());
  const idx: Partial<Record<Field, number>> = {};
  for (const { field, match } of COLUMN_MATCHERS) {
    const i = header.findIndex((h) => match(h));
    if (i < 0) {
      throw new Error(
        `Coluna para "${field}" não encontrada. Cabeçalho atual: ${header.join(' | ')}`,
      );
    }
    idx[field] = i;
  }
  const at = (line: string[], f: Field) => (line[idx[f]!] || '').trim();

  const rows: Row[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || line.every((c) => !c?.trim())) continue;
    const cod = at(line, 'cod');
    const familia = at(line, 'familia');
    const modelo = at(line, 'modelo');
    if (!cod || !familia || !modelo) continue;
    rows.push({
      cod,
      corAcabCod: at(line, 'corAcabCod'),
      colecao: at(line, 'colecao'),
      corTecido: at(line, 'corTecido'),
      acionamento: at(line, 'acionamento'),
      modelo,
      familia,
      vlrM2: parseBRNumber(at(line, 'vlrM2')),
      largMin: parseBRNumber(at(line, 'largMin')),
      altMin: parseBRNumber(at(line, 'altMin')),
      m2Min: parseBRNumber(at(line, 'm2Min')),
      largMax: parseBRNumber(at(line, 'largMax')),
      altMax: parseBRNumber(at(line, 'altMax')),
      m2Max: parseBRNumber(at(line, 'm2Max')),
    });
  }

  process.stdout.write(`> Linhas válidas: ${rows.length}\n`);
  if (rows.length < 100) {
    throw new Error(`Esperava milhares de linhas, recebi ${rows.length}.`);
  }

  // Build dictionaries
  const familias: string[] = [];
  const acionamentos: string[] = [];
  const modelos: string[] = [];
  const tipos: string[] = [];
  const colecoes: string[] = [];
  const coresTec: string[] = [];
  const coresAcab: string[] = [];

  const intern = (arr: string[], v: string): number => {
    let i = arr.indexOf(v);
    if (i < 0) {
      arr.push(v);
      i = arr.length - 1;
    }
    return i;
  };

  type Tuple = readonly [
    number, // famIdx
    number, // acionIdx
    number, // modeloIdx
    number, // tipoIdx
    number, // colIdx
    number, // corTecIdx
    number, // corAcabIdx
    number, // vlrM2
    string, // cod
  ];

  const compact: Tuple[] = [];
  const seenKey = new Set<string>();

  // Para limites de modelo, agregamos por (familia|acionamento|modelo)
  type Limits = {
    largMin: number; largMax: number;
    altMin: number; altMax: number;
    m2Min: number; m2Max: number;
  };
  const limitsMap: Record<string, Limits> = {};

  for (const r of rows) {
    const fi = intern(familias, r.familia);
    const ai = intern(acionamentos, r.acionamento);
    const mi = intern(modelos, r.modelo);
    // Tipo é inferido do nome ORIGINAL (DAY NIGHT → Outros); o nome exibido é o normalizado.
    const ti = intern(tipos, tipoTecidoFromColecao(r.colecao));
    const ci = intern(colecoes, normalizeColecao(r.colecao));
    const cti = intern(coresTec, r.corTecido);
    const cai = intern(coresAcab, r.corAcabCod);

    const dedupeKey = `${fi}|${ai}|${mi}|${ti}|${ci}|${cti}|${cai}`;
    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);

    compact.push([fi, ai, mi, ti, ci, cti, cai, r.vlrM2, r.cod] as const);

    const limKey = `${r.familia}|${r.acionamento}|${r.modelo}`;
    const cur = limitsMap[limKey];
    if (!cur) {
      limitsMap[limKey] = {
        largMin: r.largMin, largMax: r.largMax,
        altMin: r.altMin, altMax: r.altMax,
        m2Min: r.m2Min, m2Max: r.m2Max,
      };
    } else {
      cur.largMin = Math.min(cur.largMin || r.largMin, r.largMin);
      cur.largMax = Math.max(cur.largMax, r.largMax);
      cur.altMin = Math.min(cur.altMin || r.altMin, r.altMin);
      cur.altMax = Math.max(cur.altMax, r.altMax);
      cur.m2Min = Math.min(cur.m2Min || r.m2Min, r.m2Min);
      cur.m2Max = Math.max(cur.m2Max, r.m2Max);
    }
  }

  process.stdout.write(`> Combinações únicas: ${compact.length}\n`);
  process.stdout.write(`> Famílias=${familias.length} Acionamentos=${acionamentos.length} Modelos=${modelos.length} Tipos=${tipos.length} Coleções=${colecoes.length} CoresTecido=${coresTec.length} CoresAcab=${coresAcab.length}\n`);

  // Cascade indexes
  const acionByFam: Record<number, Set<number>> = {};
  const modeloByFamAcion: Record<string, Set<number>> = {};
  const tipoByFamAcionModelo: Record<string, Set<number>> = {};
  const colByModeloTipo: Record<string, Set<number>> = {};
  const corTecByModeloCol: Record<string, Set<number>> = {};
  const corAcabByModeloColCorTec: Record<string, Set<number>> = {};

  const addTo = <K extends string | number>(
    map: Record<K, Set<number>>,
    key: K,
    val: number,
  ) => {
    if (!map[key]) map[key] = new Set();
    map[key].add(val);
  };

  for (const t of compact) {
    const [fi, ai, mi, ti, ci, cti, cai] = t;
    addTo(acionByFam, fi, ai);
    addTo(modeloByFamAcion, `${fi}|${ai}`, mi);
    addTo(tipoByFamAcionModelo, `${fi}|${ai}|${mi}`, ti);
    addTo(colByModeloTipo, `${mi}|${ti}`, ci);
    addTo(corTecByModeloCol, `${mi}|${ci}`, cti);
    addTo(corAcabByModeloColCorTec, `${mi}|${ci}|${cti}`, cai);
  }

  const serializeRecord = (rec: Record<string, Set<number>>) => {
    const obj: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(rec)) {
      obj[k] = Array.from(v).sort((a, b) => a - b);
    }
    return obj;
  };
  const serializeNumRecord = (rec: Record<number, Set<number>>) => {
    const obj: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(rec)) {
      obj[Number(k)] = Array.from(v).sort((a, b) => a - b);
    }
    return obj;
  };

  const banner = `// AUTOGERADO por scripts/build-shade-catalog.ts — NÃO EDITAR À MÃO.\n// Rode \`npm run build:shade-catalog\` quando a planilha mudar.\n`;

  const catalogTs =
    banner +
    `// Total de combinações: ${compact.length}\n\n` +
    `export const FAMILIAS: readonly string[] = ${JSON.stringify(familias)};\n` +
    `export const ACIONAMENTOS: readonly string[] = ${JSON.stringify(acionamentos)};\n` +
    `export const MODELOS: readonly string[] = ${JSON.stringify(modelos)};\n` +
    `export const TIPOS_TECIDO: readonly string[] = ${JSON.stringify(tipos)};\n` +
    `export const COLECOES: readonly string[] = ${JSON.stringify(colecoes)};\n` +
    `export const CORES_TECIDO: readonly string[] = ${JSON.stringify(coresTec)};\n` +
    `export const CORES_ACAB: readonly string[] = ${JSON.stringify(coresAcab)};\n\n` +
    `export type ShadeRow = readonly [\n` +
    `  famIdx: number, acionIdx: number, modeloIdx: number,\n` +
    `  tipoIdx: number, colIdx: number, corTecIdx: number, corAcabIdx: number,\n` +
    `  vlrM2: number, codigo: string\n` +
    `];\n\n` +
    `export const ROWS: ReadonlyArray<ShadeRow> = ${JSON.stringify(compact)};\n\n` +
    `export const ACION_BY_FAM: Record<number, readonly number[]> = ${JSON.stringify(serializeNumRecord(acionByFam))};\n` +
    `export const MODELO_BY_FAM_ACION: Record<string, readonly number[]> = ${JSON.stringify(serializeRecord(modeloByFamAcion))};\n` +
    `export const TIPO_BY_FAM_ACION_MODELO: Record<string, readonly number[]> = ${JSON.stringify(serializeRecord(tipoByFamAcionModelo))};\n` +
    `export const COL_BY_MODELO_TIPO: Record<string, readonly number[]> = ${JSON.stringify(serializeRecord(colByModeloTipo))};\n` +
    `export const COR_TEC_BY_MODELO_COL: Record<string, readonly number[]> = ${JSON.stringify(serializeRecord(corTecByModeloCol))};\n` +
    `export const COR_ACAB_BY_MODELO_COL_COR_TEC: Record<string, readonly number[]> = ${JSON.stringify(serializeRecord(corAcabByModeloColCorTec))};\n`;

  const limitsTs =
    banner +
    `\nexport type ModelLimits = {\n` +
    `  largMin: number; largMax: number;\n` +
    `  altMin: number; altMax: number;\n` +
    `  m2Min: number; m2Max: number;\n` +
    `};\n\n` +
    `// Chave: \`\${familia}|\${acionamento}|\${modelo}\`\n` +
    `export const SHADE_MODEL_LIMITS: Record<string, ModelLimits> = ${JSON.stringify(limitsMap, null, 2)};\n`;

  writeFileSync(OUT_CATALOG, catalogTs, 'utf8');
  writeFileSync(OUT_LIMITS, limitsTs, 'utf8');
  process.stdout.write(`> Escrito ${OUT_CATALOG}\n`);
  process.stdout.write(`> Escrito ${OUT_LIMITS}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
