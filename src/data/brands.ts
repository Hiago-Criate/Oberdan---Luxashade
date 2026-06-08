// Marcas (Luxashade vs ShadeXP). Dados estáticos = FALLBACK; getters leem o
// catálogo ativo (Supabase) via catalogStore.

import { getRemote } from './catalogStore';

export type Brand = 'luxashade' | 'shadexp';

export const BRAND_LABEL: Record<Brand, string> = {
  luxashade: 'Luxashade',
  shadexp: 'ShadeXP',
};

export const BRAND_TAGLINE: Record<Brand, string> = {
  luxashade: 'Qualidade e Elegância em cada detalhe',
  shadexp: 'Cortinas técnicas para alta performance',
};

// Pseudo-família do trilho (aparece junto das famílias de cortina no menu).
export const TRILHO_OPT = 'TRILHO MOTORIZADO';
// Pseudo-família dos emissores/controles (aparece sempre no FINAL do menu).
export const EMISSOR_OPT = 'EMISSORES';

export const FAMILIES_BY_BRAND: Record<Brand, readonly string[]> = {
  luxashade: [TRILHO_OPT, 'ROLLER SHADE', 'DUAL SHADE', 'ROMAN SHADE', 'CELULAR SHADE', 'SOFT SHADE', EMISSOR_OPT],
  shadexp: [TRILHO_OPT, 'ROLO', 'DOUBLE VISION', 'ROMANA', 'CELULAR', 'TRIPLE SHADE', EMISSOR_OPT],
};

export const FAMILY_DISPLAY: Record<string, string> = {
  ROLO: 'ROLÔ',
  [TRILHO_OPT]: 'TRILHOS',
  [EMISSOR_OPT]: 'EMISSORES',
};

export function brandFromFamilia(familia: string): Brand {
  return FAMILIES_BY_BRAND.shadexp.includes(familia) ? 'shadexp' : 'luxashade';
}

// ----- Getters do catálogo ativo -----
export function familiesForBrand(brand: Brand): string[] {
  const r = getRemote();
  if (r) {
    const menu: string[] = Array.isArray(r.config?.menu_familias?.[brand])
      ? r.config.menu_familias[brand]
      : [...FAMILIES_BY_BRAND[brand]];
    // mantém só TRILHO + EMISSORES + famílias ativas (presentes em remote.familias)
    const ativas = new Set(r.familias.map((f) => f.nome));
    const base = menu.filter((f) => f === TRILHO_OPT || f === EMISSOR_OPT || ativas.has(f));
    // EMISSORES sempre presente e no final do menu.
    return base.includes(EMISSOR_OPT) ? base : [...base, EMISSOR_OPT];
  }
  return [...FAMILIES_BY_BRAND[brand]];
}

export function familyDisplay(nome: string): string {
  const r = getRemote();
  if (r && r.config?.family_display && r.config.family_display[nome]) {
    return r.config.family_display[nome];
  }
  return FAMILY_DISPLAY[nome] ?? nome;
}

export function brandTagline(brand: Brand): string {
  const r = getRemote();
  if (r && r.config?.brand_taglines && r.config.brand_taglines[brand]) {
    return r.config.brand_taglines[brand];
  }
  return BRAND_TAGLINE[brand];
}
