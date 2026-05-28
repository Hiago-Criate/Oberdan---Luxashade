// Marcas (Luxashade vs ShadeXP). Cada marca expõe um subconjunto das famílias
// catalogadas em shadeCatalog.ts.

export type Brand = 'luxashade' | 'shadexp';

export const BRAND_LABEL: Record<Brand, string> = {
  luxashade: 'Luxashade',
  shadexp: 'ShadeXP',
};

export const BRAND_TAGLINE: Record<Brand, string> = {
  luxashade: 'Qualidade e Elegância em cada detalhe',
  shadexp: 'Cortinas técnicas para alta performance',
};

// Pseudo-família para o trilho — fica junto das famílias de cortina no mesmo
// dropdown de "Categoria" do fluxo Luxashade.
export const TRILHO_OPT = 'TRILHO MOTORIZADO';

// Famílias por marca (na ordem que aparecem no menu).
// Os nomes batem exatamente com FAMILIAS em shadeCatalog.ts.
export const FAMILIES_BY_BRAND: Record<Brand, readonly string[]> = {
  luxashade: [
    TRILHO_OPT,
    'ROLLER SHADE',
    'DUAL SHADE',
    'ROMAN SHADE',
    'CELULAR SHADE',
    'SOFT SHADE',
  ],
  shadexp: [
    TRILHO_OPT,
    'ROLO',
    'DOUBLE VISION',
    'ROMANA',
    'CELULAR',
    'TRIPLE SHADE',
  ],
};

// Nomes "vendáveis" para exibir no menu (ROLO → ROLÔ, etc.).
export const FAMILY_DISPLAY: Record<string, string> = {
  ROLO: 'ROLÔ',
  [TRILHO_OPT]: 'TRILHOS',
};

export function brandFromFamilia(familia: string): Brand {
  return FAMILIES_BY_BRAND.shadexp.includes(familia) ? 'shadexp' : 'luxashade';
}
