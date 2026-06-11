// Cálculo de preço para as cortinas (Shade).
// Preço = max(m², m²Min) × Vlr m² × quantidade + motor + opcionais.
// Lê do catálogo ATIVO (Supabase com fallback estático) via catalogStore.

import { activeProducts, activeLimits } from '../data/catalogStore';
import type { ModelLimits } from '../data/shadeModelLimits';
import { motorPriceFor } from './motorPrices';
import { motorColorFromAcabamento } from '../types/order';

export type ShadeDraft = {
  familia?: string;
  acionamento?: string;
  modelo?: string;
  tipoTecido?: string;
  colecao?: string;
  corTecido?: string;
  corAcabamento?: string;
  motor?: string;
  widthMm?: number;
  heightMm?: number;
  quantity?: number;
  opcionaisTotal?: number;
};

export type ShadeQuote =
  | {
      ok: true;
      price: number;
      m2: number;
      m2Cobrado: number;
      vlrM2: number;
      codigo: string;
      motorPrice: number;
      limits: ModelLimits;
    }
  | {
      ok: false;
      reason:
        | 'INCOMPLETO'
        | 'SEM_LIMITES'
        | 'LARGURA_INVALIDA'
        | 'ALTURA_INVALIDA'
        | 'AREA_EXCEDIDA'
        | 'LARGURA_TECIDO'
        | 'SEM_PRODUTO';
      limits?: ModelLimits;
      m2?: number;
    };

export function getLimits(familia?: string, acionamento?: string, modelo?: string): ModelLimits | null {
  if (!familia || !acionamento || !modelo) return null;
  return activeLimits()[`${familia}|${acionamento}|${modelo}`] ?? null;
}

function findProduct(d: {
  familia: string; acionamento: string; modelo: string; tipoTecido: string;
  colecao: string; corTecido: string; corAcabamento: string;
}) {
  return (
    activeProducts().find(
      (p) =>
        p.familia === d.familia &&
        p.acionamento === d.acionamento &&
        p.modelo === d.modelo &&
        p.tipo === d.tipoTecido &&
        p.colecao === d.colecao &&
        p.corTecido === d.corTecido &&
        p.corAcab === d.corAcabamento,
    ) ?? null
  );
}

export function calculateShadePrice(draft: ShadeDraft): ShadeQuote {
  const {
    familia, acionamento, modelo, tipoTecido, colecao, corTecido, corAcabamento,
    motor, widthMm, heightMm, quantity, opcionaisTotal = 0,
  } = draft;

  if (
    !familia || !acionamento || !modelo || !tipoTecido ||
    !colecao || !corTecido || !corAcabamento ||
    !widthMm || !heightMm
  ) {
    return { ok: false, reason: 'INCOMPLETO' };
  }

  const limits = getLimits(familia, acionamento, modelo);
  if (!limits) return { ok: false, reason: 'SEM_LIMITES' };

  if (widthMm < limits.largMin || widthMm > limits.largMax) {
    return { ok: false, reason: 'LARGURA_INVALIDA', limits };
  }
  if (heightMm < limits.altMin || heightMm > limits.altMax) {
    return { ok: false, reason: 'ALTURA_INVALIDA', limits };
  }

  const m2 = (widthMm * heightMm) / 1_000_000;
  if (m2 > limits.m2Max) {
    return { ok: false, reason: 'AREA_EXCEDIDA', limits, m2 };
  }

  const prod = findProduct({ familia, acionamento, modelo, tipoTecido, colecao, corTecido, corAcabamento });
  if (!prod) return { ok: false, reason: 'SEM_PRODUTO', limits, m2 };

  // Largura máxima específica do tecido (override) — não fabricável acima disso.
  if (prod.largMaxOverride != null && widthMm > prod.largMaxOverride) {
    return { ok: false, reason: 'LARGURA_TECIDO', limits, m2 };
  }

  const vlrM2 = prod.vlrM2;
  const codigo = prod.codigo;

  const m2Cobrado = Math.max(m2, limits.m2Min);
  let motorPrice = 0;
  if (acionamento !== 'MANUAL' && motor) {
    const cor = motorColorFromAcabamento(corAcabamento);
    motorPrice = motorPriceFor(motor, cor);
    // DUPLA LIVRE = 2 trilhos independentes → 2 motores. DUPLA TRAVA = 1 motor.
    if (/\bDUPLA\b/i.test(modelo) && /\bLIVRE\b/i.test(modelo)) {
      motorPrice *= 2;
    }
  }
  const qty = quantity && quantity > 0 ? quantity : 1;
  const price = Math.round((m2Cobrado * vlrM2 + motorPrice + opcionaisTotal) * qty * 100) / 100;

  return { ok: true, price, m2, m2Cobrado, vlrM2, codigo, motorPrice, limits };
}
