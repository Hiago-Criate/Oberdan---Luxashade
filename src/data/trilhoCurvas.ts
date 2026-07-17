// Curvas calandradas do trilho motorizado Trioflex — opcional do trilho.
// Agora vêm do catálogo ATIVO (Supabase get_catalog -> trilho_curvas), editáveis
// no /admin. A lista abaixo é só FALLBACK offline (mesmos valores do seed).
// Fonte: tabela "Trilhos Motorizados Trioflex" (Lília). Valor FIXO por trilho.

import { getRemote } from './catalogStore';

export interface CurvaTrilho {
  codigo: string;
  descricao: string;
  valor: number; // R$ fixo
}

// Fallback estático (offline / banco indisponível).
export const CURVAS_TRILHO_FALLBACK: readonly CurvaTrilho[] = [
  { codigo: '154.27.00', descricao: '1 Curva Calandrada 90°', valor: 423.5 },
  { codigo: '154.28.00', descricao: '2 Curvas Calandradas 90°', valor: 726 },
  { codigo: '154.29.00', descricao: 'Curva Contínua Calandrada (trilho até 6 m)', valor: 423.5 },
  { codigo: '154.30.00', descricao: 'Curva Contínua Calandrada (trilho acima de 6 m)', valor: 726 },
];

// Lista ativa (banco quando disponível; senão, fallback).
export function getCurvasTrilho(): readonly CurvaTrilho[] {
  const r = getRemote();
  if (r && r.trilhoCurvas?.length) return r.trilhoCurvas;
  return CURVAS_TRILHO_FALLBACK;
}

export function curvaByCodigo(codigo?: string | null): CurvaTrilho | undefined {
  return codigo ? getCurvasTrilho().find((c) => c.codigo === codigo) : undefined;
}
