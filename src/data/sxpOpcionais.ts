// Acessórios opcionais ShadeXP. Dados estáticos = FALLBACK; em runtime lê do
// catálogo ativo (Supabase) via catalogStore.

import { getRemote, type RemoteOpcional } from './catalogStore';

export type FormulaOpcional = 'fixo' | 'porLargura' | 'porAltura' | 'porAltComando';

export interface OpcionalRule {
  codigo: string;
  descricao: string;
  valor: number;
  formula: FormulaOpcional;
  exclusiveWith?: readonly string[];
  obs?: string;
}

// ----- Fallback estático -----
export const SXP_OPCIONAIS_BY_MODEL: Record<string, readonly OpcionalRule[]> = {
  'CORTINA ROLO SXP38 AC MANUAL': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo', obs: 'Disponível quando não houver Bandô.', exclusiveWith: ['A306.01.xx'] },
    { codigo: '207.01.00', descricao: 'Corrente Metálica Bola 10', valor: 33, formula: 'porAltComando', obs: 'R$ 33 × Altura do Comando (m).' },
    { codigo: 'A306.01.xx', descricao: 'Bandô C', valor: 160, formula: 'porLargura', obs: 'R$ 160 × Largura (m). Exclusivo do RL38.', exclusiveWith: ['TDF'] },
    { codigo: 'A306.55.xx', descricao: 'Guia Lateral 55mm (Par)', valor: 162.8, formula: 'porAltura', obs: 'R$ 162,80 × Altura (m).' },
  ],
  'CORTINA ROLO SXP50 AC MANUAL': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo', obs: 'Disponível quando não houver Bandô.', exclusiveWith: ['A306.12.xx'] },
    { codigo: '207.01.00', descricao: 'Corrente Metálica Bola 10', valor: 33, formula: 'porAltComando', obs: 'R$ 33 × Altura do Comando (m).' },
    { codigo: 'A306.12.xx', descricao: 'Bandô Quadrado', valor: 195, formula: 'porLargura', obs: 'R$ 195 × Largura (m). Exclusivo do RL50.', exclusiveWith: ['TDF'] },
    { codigo: 'A306.55.xx', descricao: 'Guia Lateral 55mm (Par)', valor: 162.8, formula: 'porAltura', obs: 'R$ 162,80 × Altura (m).' },
  ],
  'CORTINA ROLO SXP55 AC MOTORIZADO': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo', obs: 'Disponível quando não houver Bandô.', exclusiveWith: ['A306.13.xx'] },
    { codigo: 'A306.13.xx', descricao: 'Bandô Quadrado', valor: 195, formula: 'porAltura', obs: 'R$ 195 × Altura (m). Exclusivo do RL55.', exclusiveWith: ['TDF'] },
    { codigo: 'A306.55.xx', descricao: 'Guia Lateral 55mm (Par)', valor: 162.8, formula: 'porAltura', obs: 'R$ 162,80 × Altura (m). Exclusivo do RL55.' },
  ],
  'CORTINA ROLO SX65 AC MOTORIZADO': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo' },
    { codigo: 'A306.80.xx', descricao: 'Guia Lateral 80mm (Par)', valor: 198, formula: 'porAltura', obs: 'R$ 198 × Altura (m).' },
  ],
  'CORTINA ROLO SXP75 AC MOTORIZADO': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo' },
    { codigo: 'A306.80.xx', descricao: 'Guia Lateral 80mm (Par)', valor: 198, formula: 'porAltura', obs: 'R$ 198 × Altura (m).' },
  ],
  'CORTINA ROLO SXP95 AC MOTORIZADO': [
    { codigo: 'TDF', descricao: 'Tecido Desce pela Frente', valor: 0, formula: 'fixo' },
    { codigo: 'A306.80.xx', descricao: 'Guia Lateral 80mm (Par)', valor: 198, formula: 'porAltura', obs: 'R$ 198 × Altura (m).' },
  ],
  'CORTINA TRIPLE SHADE SXP50 ACIONAMENTO MANUAL': [
    { codigo: 'A306.10.xx', descricao: 'Square Box LXG', valor: 198, formula: 'porLargura', obs: 'R$ 198 × Largura (m).' },
  ],
  'CORTINA TRIPLE SHADE SXP50 MOTORIZADA': [
    { codigo: 'A306.10.xx', descricao: 'Square Box LXG', valor: 198, formula: 'porLargura', obs: 'R$ 198 × Largura (m).' },
  ],
  'CORTINA DOUBLE VISION SXP38 ACIONAMENTO MANUAL': [
    { codigo: 'A306.10.xx', descricao: 'Square Box LXG', valor: 198, formula: 'porLargura', obs: 'R$ 198 × Largura (m).' },
  ],
  'CORTINA DOUBLE VISION SXP50 ACIONAMENTO MANUAL': [
    { codigo: 'A306.10.xx', descricao: 'Square Box LXG', valor: 198, formula: 'porLargura', obs: 'R$ 198 × Largura (m).' },
  ],
  'CORTINA DOUBLE VISION SXP50 MOTORIZADA': [
    { codigo: 'A306.10.xx', descricao: 'Square Box LXG', valor: 198, formula: 'porLargura', obs: 'R$ 198 × Largura (m).' },
  ],
};

export const SXP_CONTROLES_MOTORIZADA: readonly OpcionalRule[] = [
  { codigo: '155.34.01', descricao: 'Emissor Shadeexp 1 Canal', valor: 98, formula: 'fixo' },
  { codigo: '155.35.01', descricao: 'Emissor Shadeexp 15 Canais', valor: 158, formula: 'fixo' },
  { codigo: '222.06.00', descricao: 'Controle Somfy Situo 1 Canal', valor: 290, formula: 'fixo' },
  { codigo: '222.10.00', descricao: 'Controle Somfy Situo 4 Canais + Grupo', valor: 550, formula: 'fixo' },
  { codigo: '222.05.00', descricao: 'Controle Somfy 16 Canais Rts', valor: 1680, formula: 'fixo' },
];

const FALLBACK_REGRA_4X: ReadonlySet<string> = new Set(['ROLO', 'TRIPLE SHADE', 'DOUBLE VISION']);
export const SXP_ALTURAS_COMANDO_MM: readonly number[] = [500, 1000, 1200, 1500, 1800, 2000, 2500, 3000];

// Luxashade — acionamento MANUAL por corrente contínua (Lília, 2026-06-23).
// Para estas famílias o comando manual usa corrente contínua, disponível só nestas
// alturas. A revenda DEVE informar a altura do comando (vira chips, não texto livre).
export const LUXA_ALTURAS_COMANDO_MM: readonly number[] = [500, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000, 5000];
export const LUXA_CORRENTE_CONTINUA_FAMILIAS: ReadonlySet<string> = new Set([
  'ROMAN SHADE', 'DUAL SHADE', 'SOFT SHADE', 'CELULAR SHADE',
]);

// ----- Conversão remoto -> OpcionalRule -----
function fromRemote(o: RemoteOpcional): OpcionalRule {
  return {
    codigo: o.codigo,
    descricao: o.descricao,
    valor: o.valor,
    formula: o.formula,
    obs: o.obs ?? undefined,
    exclusiveWith: o.exclui && o.exclui.length ? o.exclui : undefined,
  };
}

export function requiresAltura4xLargura(familia: string): boolean {
  const r = getRemote();
  if (r) {
    const list: string[] = Array.isArray(r.config?.regra_4x_familias) ? r.config.regra_4x_familias : [];
    return list.includes(familia);
  }
  return FALLBACK_REGRA_4X.has(familia);
}

export function getSxpAlturasComando(): readonly number[] {
  const r = getRemote();
  if (r && Array.isArray(r.config?.sxp_alturas_comando)) return r.config.sxp_alturas_comando as number[];
  return SXP_ALTURAS_COMANDO_MM;
}

export function getLuxaAlturasComando(): readonly number[] {
  const r = getRemote();
  if (r && Array.isArray(r.config?.luxa_alturas_comando)) return r.config.luxa_alturas_comando as number[];
  return LUXA_ALTURAS_COMANDO_MM;
}

// True quando o comando manual desta família (no app Luxashade) é por corrente
// contínua → altura escolhida em chips a partir de getLuxaAlturasComando().
export function usaCorrenteContinua(familia: string): boolean {
  const r = getRemote();
  if (r && Array.isArray(r.config?.luxa_corrente_continua_familias)) {
    return (r.config.luxa_corrente_continua_familias as string[]).includes(familia);
  }
  return LUXA_CORRENTE_CONTINUA_FAMILIAS.has(familia);
}

export function opcionaisFor(modelo: string): readonly OpcionalRule[] {
  // Controles/emissores NÃO entram mais aqui: viraram um item próprio do pedido
  // (categoria "EMISSORES" → ver src/data/emissores.ts). Aqui ficam só os
  // acessórios por modelo (TDF, Bandô, guias, square box, etc.).
  const r = getRemote();
  if (r) return (r.opcionaisPorModelo[modelo] ?? []).map(fromRemote);
  return SXP_OPCIONAIS_BY_MODEL[modelo] ?? [];
}

export function calcOpcionalPrice(
  rule: OpcionalRule,
  ctx: { widthMm: number; heightMm: number; comandoAlturaMm: number },
): number {
  const w = ctx.widthMm / 1000;
  const h = ctx.heightMm / 1000;
  const ac = ctx.comandoAlturaMm / 1000;
  switch (rule.formula) {
    case 'fixo': return rule.valor;
    case 'porLargura': return rule.valor * w;
    case 'porAltura': return rule.valor * h;
    case 'porAltComando': return rule.valor * ac;
  }
}
