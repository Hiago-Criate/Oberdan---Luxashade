// Acessórios opcionais ShadeXP por modelo (Descricao Grupo).
// Regras extraídas da planilha "Form PEDIDO" da ShadeXP.
// Fórmulas: a cobrança é "valor × medida (em metros)" — exceto quando
// formula === 'fixo' (valor único independente do tamanho).

export type FormulaOpcional =
  | 'fixo'
  | 'porLargura'      // valor × largura(m)
  | 'porAltura'       // valor × altura(m)
  | 'porAltComando';  // valor × altura do comando(m)

export interface OpcionalRule {
  codigo: string;
  descricao: string;
  valor: number;
  formula: FormulaOpcional;
  /** Códigos de outros opcionais que são mutuamente exclusivos com este. */
  exclusiveWith?: readonly string[];
  /** Texto curto explicando a regra (mostrado abaixo do nome). */
  obs?: string;
}

// Sufixo após o nome do modelo na catalogação — chave do map.
// Modelos vêm de MODELOS em shadeCatalog.ts.
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
  // ROMANA RO1/RO2, CELULAR CL1/CL2 — sem acessórios específicos na planilha.
};

// Controles/Emissores são opcionais comuns a qualquer motorizada ShadeXP.
export const SXP_CONTROLES_MOTORIZADA: readonly OpcionalRule[] = [
  { codigo: '155.34.01', descricao: 'Emissor Shadeexp 1 Canal', valor: 98, formula: 'fixo' },
  { codigo: '155.35.01', descricao: 'Emissor Shadeexp 15 Canais', valor: 158, formula: 'fixo' },
  { codigo: '222.06.00', descricao: 'Controle Somfy Situo 1 Canal', valor: 290, formula: 'fixo' },
  { codigo: '222.10.00', descricao: 'Controle Somfy Situo 4 Canais + Grupo', valor: 550, formula: 'fixo' },
  { codigo: '222.05.00', descricao: 'Controle Somfy 16 Canais Rts', valor: 1680, formula: 'fixo' },
];

// Família/modelos para os quais Altura ≤ 4 × Largura é regra (planilha SXP).
const FAMILIAS_REGRA_4X: ReadonlySet<string> = new Set([
  'ROLO', 'TRIPLE SHADE', 'DOUBLE VISION',
]);

export function requiresAltura4xLargura(familia: string): boolean {
  return FAMILIAS_REGRA_4X.has(familia);
}

// Alturas de comando padronizadas pela ShadeXP (corrente contínua).
export const SXP_ALTURAS_COMANDO_MM: readonly number[] = [
  500, 1000, 1200, 1500, 1800, 2000, 2500, 3000,
];

export function opcionaisFor(modelo: string, acionamento: string): readonly OpcionalRule[] {
  const base = SXP_OPCIONAIS_BY_MODEL[modelo] ?? [];
  const isMotorizada = acionamento !== 'MANUAL';
  return isMotorizada ? [...base, ...SXP_CONTROLES_MOTORIZADA] : base;
}

export function calcOpcionalPrice(
  rule: OpcionalRule,
  ctx: { widthMm: number; heightMm: number; comandoAlturaMm: number },
): number {
  const w = ctx.widthMm / 1000;
  const h = ctx.heightMm / 1000;
  const ac = ctx.comandoAlturaMm / 1000;
  switch (rule.formula) {
    case 'fixo':         return rule.valor;
    case 'porLargura':   return rule.valor * w;
    case 'porAltura':    return rule.valor * h;
    case 'porAltComando': return rule.valor * ac;
  }
}
