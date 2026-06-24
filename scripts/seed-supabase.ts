// Popula o Supabase com TODOS os dados atuais do catálogo estático.
// Uso: SUPABASE_ADMIN_PASSWORD=... npx tsx scripts/seed-supabase.ts
//
// Lê os arquivos de dados existentes (fonte da verdade atual) e insere
// nas tabelas do painel. As tabelas devem estar vazias (TRUNCATE antes).

import { createClient } from '@supabase/supabase-js';
import {
  FAMILIAS, ACIONAMENTOS, MODELOS, TIPOS_TECIDO, COLECOES, CORES_TECIDO, CORES_ACAB, ROWS,
} from '../src/data/shadeCatalog';
import { SHADE_MODEL_LIMITS } from '../src/data/shadeModelLimits';
import { PRODUTOS } from '../src/utils/calculator';
import { MOTOR_PRICES, MOTORS, SXP_SHADE_MOTORS } from '../src/utils/motorPrices';
import {
  SXP_OPCIONAIS_BY_MODEL, SXP_ALTURAS_COMANDO_MM,
} from '../src/data/sxpOpcionais';
import { EMISSORES_FALLBACK } from '../src/data/emissores';
import {
  FAMILIES_BY_BRAND, FAMILY_DISPLAY, BRAND_TAGLINE, BRAND_LABEL,
  brandFromFamilia, TRILHO_OPT,
} from '../src/data/brands';

const SUPABASE_URL = 'https://umvbrahsqvqeondwtikm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_thvgLpTYDPajbwUrwq8Agw_n9zeywnD';
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || 'admin@luxashade.app';
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || 'LuxaShade#2026';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const ACAB_NOME: Record<string, string> = { '01': 'Branco', '02': 'Bege', '03': 'Cinza', '05': 'Preto' };
const ACAB_HEX: Record<string, string> = { '01': '#f5f5f5', '02': '#d8c6a4', '03': '#9aa0a6', '05': '#1a1a1a' };
const normAcab = (c: string): string => (({ '1': '01', '2': '02', '3': '03', '5': '05' } as Record<string, string>)[c] ?? c);

async function insertBatch(table: string, rows: any[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from(table).insert(slice);
    if (error) throw new Error(`insert ${table} [${i}..${i + slice.length}]: ${error.message}`);
  }
  console.log(`  ✓ ${table}: ${rows.length}`);
}

async function main() {
  console.log('> Login admin…');
  const { error: authErr } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (authErr) throw new Error(`Auth: ${authErr.message}`);

  // ---- Marcas ----
  await insertBatch('marcas', (['luxashade', 'shadexp'] as const).map((c, i) => ({
    codigo: c, label: BRAND_LABEL[c], tagline: BRAND_TAGLINE[c], ordem: i,
  })));

  // ---- Acionamentos ----
  await insertBatch('acionamentos', ACIONAMENTOS.map((nome, i) => ({ nome, label: nome, ordem: i })));

  // ---- Tipos de tecido ----
  await insertBatch('tipos_tecido', TIPOS_TECIDO.map((nome, i) => ({ nome, label: nome, ordem: i })));

  // ---- Cores de acabamento ----
  await insertBatch('cores_acabamento', ['01', '02', '03', '05'].map((codigo, i) => ({
    codigo, nome: ACAB_NOME[codigo], hex: ACAB_HEX[codigo], ordem: i,
  })));

  // ---- Famílias ----
  await insertBatch('familias', FAMILIAS.map((nome, i) => ({
    nome, marca: brandFromFamilia(nome), display_name: FAMILY_DISPLAY[nome] ?? null, ordem: i,
  })));

  const { data: famRows } = await sb.from('familias').select('id, nome');
  const famId: Record<string, number> = {};
  for (const f of famRows ?? []) famId[(f as any).nome] = (f as any).id;

  // modelo -> família e coleção -> tipo (primeiro ROW de cada)
  const modeloFamilia: Record<string, string> = {};
  const colTipo: Record<string, string> = {};
  for (const r of ROWS) {
    const modelo = MODELOS[r[2] as number];
    if (!modeloFamilia[modelo]) modeloFamilia[modelo] = FAMILIAS[r[0] as number];
    const col = COLECOES[r[4] as number];
    if (!colTipo[col]) colTipo[col] = TIPOS_TECIDO[r[3] as number];
  }

  // ---- Modelos ----
  await insertBatch('modelos', MODELOS.map((nome, i) => ({
    nome, familia_id: famId[modeloFamilia[nome]] ?? null, ordem: i,
  })));

  // ---- Coleções ----
  await insertBatch('colecoes', COLECOES.map((nome, i) => ({ nome, tipo_tecido: colTipo[nome] ?? null, ordem: i })));

  // ---- Cores de tecido ----
  await insertBatch('cores_tecido', CORES_TECIDO.map((nome, i) => ({ nome, ordem: i })));

  // ---- Produtos (8015) ----
  await insertBatch('produtos', ROWS.map((r) => ({
    familia: FAMILIAS[r[0] as number],
    acionamento: ACIONAMENTOS[r[1] as number],
    modelo: MODELOS[r[2] as number],
    tipo_tecido: TIPOS_TECIDO[r[3] as number],
    colecao: COLECOES[r[4] as number],
    cor_tecido: CORES_TECIDO[r[5] as number],
    cor_acab: normAcab(CORES_ACAB[r[6] as number]),
    vlr_m2: r[7],
    codigo: r[8],
  })));

  // ---- Limites por modelo ----
  await insertBatch('modelo_limites', Object.entries(SHADE_MODEL_LIMITS).map(([key, v]) => {
    const [familia, acionamento, modelo] = key.split('|');
    return {
      familia, acionamento, modelo,
      larg_min: v.largMin, larg_max: v.largMax, alt_min: v.altMin, alt_max: v.altMax,
      m2_min: v.m2Min, m2_max: v.m2Max,
    };
  }));

  // ---- Motores ----
  await insertBatch('motores', Object.entries(MOTOR_PRICES).map(([nome, p], i) => ({
    nome, preco_branco: p.Branco, preco_preto: p.Preto,
    uso_trilho: (MOTORS as readonly string[]).includes(nome),
    uso_shade: (SXP_SHADE_MOTORS as readonly string[]).includes(nome),
    informativo: /SEM MOTOR/i.test(nome), ordem: i,
  })));

  // ---- Motor × grupo de produtos (modelos MOTORIZADOS) — preserva comportamento ----
  const { data: motRows } = await sb.from('motores').select('id, nome, uso_trilho, uso_shade');
  const motorizadosByMarca: Record<'luxashade' | 'shadexp', Set<string>> = { luxashade: new Set(), shadexp: new Set() };
  for (const r of ROWS) {
    if (ACIONAMENTOS[r[1] as number] === 'MANUAL') continue;
    const fam = FAMILIAS[r[0] as number];
    motorizadosByMarca[brandFromFamilia(fam)].add(MODELOS[r[2] as number]);
  }
  const motorModelos: any[] = [];
  for (const mt of (motRows ?? []) as any[]) {
    if (mt.uso_shade) for (const m of motorizadosByMarca.shadexp) motorModelos.push({ motor_id: mt.id, modelo: m });
    if (mt.uso_trilho) for (const m of motorizadosByMarca.luxashade) motorModelos.push({ motor_id: mt.id, modelo: m });
  }
  if (motorModelos.length) await insertBatch('motor_modelos', motorModelos);

  // ---- Trilhos: modelos ----
  const trilhoModelos: [string, string][] = [
    ['01', 'Prega'], ['02', 'Modelo movimento'], ['03', 'Wave 2.4'],
    ['04', 'Wave 3.4'], ['05', 'Wave 1.7'], ['06', 'Wave 2.7'],
  ];
  await insertBatch('trilho_modelos', trilhoModelos.map(([codigo, nome], i) => ({ codigo, nome, ordem: i })));

  // ---- Trilhos: produtos + componentes ----
  const trilhoProdutos: any[] = [];
  const trilhoComponentes: any[] = [];
  for (const codigo of Object.keys(PRODUTOS)) {
    const p = PRODUTOS[codigo];
    const seg = codigo.split('.');               // ['255','01','01C']
    const tail = seg[2] || '';
    const corCod = tail.slice(0, 2);
    trilhoProdutos.push({
      codigo, modelo_codigo: seg[1], descricao: p.descricao,
      cor: corCod === '05' ? 'Preto' : 'Branco',
      abertura: tail.endsWith('L') ? 'Lateral' : 'Central',
    });
    (p.componentes || []).forEach((c: any, i: number) => {
      trilhoComponentes.push({
        trilho_codigo: codigo, comp_codigo: c.c, quantidade: c.q,
        formula: c.f || '', valor: c.v, ordem: i,
      });
    });
  }
  await insertBatch('trilho_produtos', trilhoProdutos);
  await insertBatch('trilho_componentes', trilhoComponentes);

  // ---- Opcionais (ShadeXP) — DEDUPLICADOS por código (cada acessório 1x, ligado a N modelos) ----
  type Acc = { codigo: string; descricao: string; valor: number; formula: string; obs: string | null; modelos: Set<string>; exclui: Set<string> };
  const accByCodigo: Record<string, Acc> = {};
  for (const [modelo, rules] of Object.entries(SXP_OPCIONAIS_BY_MODEL)) {
    for (const r of rules) {
      const a = (accByCodigo[r.codigo] ??= { codigo: r.codigo, descricao: r.descricao, valor: r.valor, formula: r.formula, obs: r.obs ?? null, modelos: new Set(), exclui: new Set() });
      a.modelos.add(modelo);
      (r.exclusiveWith ?? []).forEach((c) => a.exclui.add(c));
    }
  }
  const accs = Object.values(accByCodigo);
  const { data: insOpc, error: eOpc } = await sb.from('opcionais').insert(
    accs.map((a, i) => ({ codigo: a.codigo, descricao: a.descricao, valor: a.valor, formula: a.formula, obs: a.obs, tipo: 'modelo', ordem: i })),
  ).select('id, codigo');
  if (eOpc) throw new Error(`opcionais: ${eOpc.message}`);
  const idByCodigo: Record<string, number> = {};
  for (const row of insOpc ?? []) idByCodigo[(row as any).codigo] = (row as any).id;
  const opcLinks: any[] = [];
  const opcExcl: any[] = [];
  for (const a of accs) {
    for (const m of a.modelos) opcLinks.push({ opcional_id: idByCodigo[a.codigo], modelo: m });
    for (const c of a.exclui) opcExcl.push({ opcional_id: idByCodigo[a.codigo], exclui_codigo: c });
  }
  if (opcLinks.length) await insertBatch('opcional_modelos', opcLinks);
  if (opcExcl.length) await insertBatch('opcional_exclusoes', opcExcl);
  console.log(`  ✓ opcionais (deduplicados): ${accs.length}`);
  // ---- Emissores / controles (entidade própria) ----
  await insertBatch('emissores', EMISSORES_FALLBACK.map((e, i) => ({
    codigo: e.codigo, descricao: e.descricao, valor: e.valor, canais: e.canais,
    motor_brand: e.motorBrand,
    brand_luxashade: e.brands.includes('luxashade'),
    brand_shadexp: e.brands.includes('shadexp'),
    ordem: i,
  })));

  // ---- Config geral ----
  await insertBatch('app_config', [
    { chave: 'family_display', valor: FAMILY_DISPLAY, descricao: 'Nomes de exibição (ex: ROLO → ROLÔ)' },
    { chave: 'menu_familias', valor: { luxashade: FAMILIES_BY_BRAND.luxashade, shadexp: FAMILIES_BY_BRAND.shadexp }, descricao: 'Famílias e ordem no menu por marca' },
    { chave: 'regra_4x_familias', valor: ['ROLO', 'TRIPLE SHADE', 'DOUBLE VISION'], descricao: 'Famílias com regra Altura ≤ 4 × Largura' },
    { chave: 'sxp_alturas_comando', valor: SXP_ALTURAS_COMANDO_MM, descricao: 'Alturas de comando padrão (ShadeXP)' },
    { chave: 'trilho_multiplicador', valor: { branco: 1.1, preto: 1.2 }, descricao: 'Multiplicador de preço do trilho por cor' },
    { chave: 'brand_taglines', valor: BRAND_TAGLINE, descricao: 'Tagline de cada marca' },
    { chave: 'trilho_opt_label', valor: { value: TRILHO_OPT, display: FAMILY_DISPLAY[TRILHO_OPT] ?? 'TRILHOS' }, descricao: 'Rótulo da categoria Trilho' },
    { chave: 'webhook_url', valor: 'https://147hook.criate.online/webhook/94e9c23d-4b00-40aa-8e20-8e4da2c94907', descricao: 'Webhook de envio de pedido/orçamento' },
  ]);

  console.log('\n✅ Seed concluído.');
}

main().catch((e) => { console.error('\n❌', e.message || e); process.exit(1); });
