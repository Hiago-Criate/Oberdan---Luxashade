// Emissores / controles remotos — entidade de primeira classe.
//
// Fonte da verdade = tabela `emissores` no Supabase (catalogStore.emissores),
// com campos EXPLÍCITOS: nº de canais, marca do motor e marcas de cortina que
// oferecem o item. Sem heurística. Fallback estático abaixo quando offline.
//
// "Marca do motor" é texto livre/extensível (SOMFY, IVOLVE, NICE, …): o app
// monta os botões a partir das marcas realmente cadastradas.

import type { Brand } from './brands';
import { getRemote, type RemoteEmissor } from './catalogStore';

// Mantido como string para permitir novos tipos sem alterar código.
export type MotorBrand = string;

// Sugestões de marca de motor para o painel (datalist). Não limita o cadastro.
export const MOTOR_BRAND_SUGGESTIONS: readonly string[] = ['SOMFY', 'IVOLVE'];

export interface Emissor {
  codigo: string;
  descricao: string;
  valor: number;
  canais: number;
  motorBrand: MotorBrand;
  brands: readonly Brand[];
}

// ----- Fallback estático (espelha o seed inicial do banco) -----
export const EMISSORES_FALLBACK: readonly Emissor[] = [
  { codigo: '155.34.01', descricao: 'Emissor Shadeexp 1 Canal', valor: 98, canais: 1, motorBrand: 'IVOLVE', brands: ['shadexp'] },
  { codigo: '155.35.01', descricao: 'Emissor Shadeexp 15 Canais', valor: 158, canais: 15, motorBrand: 'IVOLVE', brands: ['shadexp'] },
  { codigo: '222.06.00', descricao: 'Controle Somfy Situo 1 Canal', valor: 290, canais: 1, motorBrand: 'SOMFY', brands: ['luxashade', 'shadexp'] },
  { codigo: '222.10.00', descricao: 'Controle Somfy Situo 4 Canais + Grupo', valor: 550, canais: 4, motorBrand: 'SOMFY', brands: ['luxashade', 'shadexp'] },
  { codigo: '222.05.00', descricao: 'Controle Somfy 16 Canais Rts', valor: 1680, canais: 16, motorBrand: 'SOMFY', brands: ['luxashade', 'shadexp'] },
];

const VALID_BRANDS: readonly Brand[] = ['luxashade', 'shadexp'];
function coerceBrands(arr: string[] | undefined): Brand[] {
  return (arr ?? []).filter((b): b is Brand => (VALID_BRANDS as readonly string[]).includes(b));
}

function fromRemote(e: RemoteEmissor): Emissor {
  return {
    codigo: e.codigo,
    descricao: e.descricao,
    valor: e.valor,
    canais: e.canais,
    motorBrand: e.motorBrand,
    brands: coerceBrands(e.brands),
  };
}

// Lista completa de emissores do catálogo ativo (remoto) ou do fallback estático.
export function allEmissores(): Emissor[] {
  const r = getRemote();
  if (r) return r.emissores.map(fromRemote);
  return EMISSORES_FALLBACK.map((e) => ({ ...e }));
}

// Marcas de motor (dinâmicas) que têm ao menos um emissor para a marca de
// cortina informada — na ordem em que aparecem no catálogo.
export function motorBrandsFor(brand: Brand): MotorBrand[] {
  const out: string[] = [];
  for (const e of allEmissores()) {
    if (e.brands.includes(brand) && !out.includes(e.motorBrand)) out.push(e.motorBrand);
  }
  return out;
}

// Emissores disponíveis para (marca da cortina × marca do motor).
export function emissoresFor(brand: Brand, motorBrand: MotorBrand): Emissor[] {
  return allEmissores().filter(
    (e) => e.motorBrand === motorBrand && e.brands.includes(brand),
  );
}
