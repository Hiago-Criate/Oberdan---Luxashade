// Emissores / controles remotos.
//
// Fonte única = a mesma lista de controles motorizados gerida no Admin/Supabase
// (catalogStore.opcionaisControle), com fallback estático em SXP_CONTROLES_MOTORIZADA.
// Aqui apenas enriquecemos cada controle com:
//   - marca do motor (SOMFY | IVOLVE) — derivada da descrição
//   - nº de canais — derivado da descrição ("1 Canal", "15 Canais", ...)
//   - marcas de cortina que oferecem o emissor (Luxashade | ShadeXP)
//
// Regras de derivação (até a lista definitiva da Luxashade ser cadastrada):
//   - Controles "Somfy" = hardware universal → disponíveis nas DUAS marcas.
//   - Emissores "Shadeexp" (Ivolve) → por ora só ShadeXP.

import type { Brand } from './brands';
import { getRemote } from './catalogStore';
import { SXP_CONTROLES_MOTORIZADA } from './sxpOpcionais';

export type MotorBrand = 'SOMFY' | 'IVOLVE';
export const MOTOR_BRANDS: readonly MotorBrand[] = ['SOMFY', 'IVOLVE'];

export interface Emissor {
  codigo: string;
  descricao: string;
  valor: number;
  canais: number;
  motorBrand: MotorBrand;
  brands: readonly Brand[];
}

function parseMotorBrand(descricao: string): MotorBrand {
  return /somfy/i.test(descricao) ? 'SOMFY' : 'IVOLVE';
}

function parseCanais(descricao: string): number {
  const m = descricao.match(/(\d+)\s*cana/i); // "1 Canal" / "15 Canais"
  return m ? Number(m[1]) : 1;
}

function curtainBrandsFor(motorBrand: MotorBrand): readonly Brand[] {
  // Somfy é universal; Ivolve/Shadeexp por ora só ShadeXP (lista Luxashade pendente).
  return motorBrand === 'SOMFY' ? ['luxashade', 'shadexp'] : ['shadexp'];
}

function toEmissor(o: { codigo: string; descricao: string; valor: number }): Emissor {
  const motorBrand = parseMotorBrand(o.descricao);
  return {
    codigo: o.codigo,
    descricao: o.descricao,
    valor: o.valor,
    canais: parseCanais(o.descricao),
    motorBrand,
    brands: curtainBrandsFor(motorBrand),
  };
}

// Lista completa de emissores do catálogo ativo (remoto) ou do fallback estático.
export function allEmissores(): Emissor[] {
  const r = getRemote();
  const src = r ? r.opcionaisControle : SXP_CONTROLES_MOTORIZADA;
  return src.map(toEmissor);
}

// Marcas de motor que têm ao menos um emissor para a marca de cortina informada.
export function motorBrandsFor(brand: Brand): MotorBrand[] {
  const list = allEmissores().filter((e) => e.brands.includes(brand));
  return MOTOR_BRANDS.filter((mb) => list.some((e) => e.motorBrand === mb));
}

// Emissores disponíveis para (marca da cortina × marca do motor).
export function emissoresFor(brand: Brand, motorBrand: MotorBrand): Emissor[] {
  return allEmissores().filter(
    (e) => e.motorBrand === motorBrand && e.brands.includes(brand),
  );
}
