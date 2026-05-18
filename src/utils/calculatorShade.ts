// Cálculo de preço para as 10 famílias de cortinas (Shade).
// Preço = max(m², m²Min) × Vlr m² × quantidade + motor (se Motorizada/Motor Bateria).

import {
  ROWS,
  FAMILIAS,
  ACIONAMENTOS,
  MODELOS,
  TIPOS_TECIDO,
  COLECOES,
  CORES_TECIDO,
  CORES_ACAB,
} from '../data/shadeCatalog';
import { SHADE_MODEL_LIMITS } from '../data/shadeModelLimits';
import { MOTOR_PRICES } from './motorPrices';
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
  opcionaisTotal?: number; // soma já calculada por peça (vinda do form)
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
      limits: NonNullable<ReturnType<typeof getLimits>>;
    }
  | {
      ok: false;
      reason:
        | 'INCOMPLETO'
        | 'SEM_LIMITES'
        | 'LARGURA_INVALIDA'
        | 'ALTURA_INVALIDA'
        | 'AREA_EXCEDIDA'
        | 'SEM_PRODUTO';
      limits?: NonNullable<ReturnType<typeof getLimits>>;
      m2?: number;
    };

export function getLimits(familia?: string, acionamento?: string, modelo?: string) {
  if (!familia || !acionamento || !modelo) return null;
  return SHADE_MODEL_LIMITS[`${familia}|${acionamento}|${modelo}`] ?? null;
}

function findRow(
  famIdx: number,
  acionIdx: number,
  modeloIdx: number,
  tipoIdx: number,
  colIdx: number,
  corTecIdx: number,
  corAcabIdx: number,
) {
  for (const r of ROWS) {
    if (
      r[0] === famIdx &&
      r[1] === acionIdx &&
      r[2] === modeloIdx &&
      r[3] === tipoIdx &&
      r[4] === colIdx &&
      r[5] === corTecIdx &&
      r[6] === corAcabIdx
    ) {
      return r;
    }
  }
  return null;
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

  const famIdx = FAMILIAS.indexOf(familia);
  const acionIdx = ACIONAMENTOS.indexOf(acionamento);
  const modeloIdx = MODELOS.indexOf(modelo);
  const tipoIdx = TIPOS_TECIDO.indexOf(tipoTecido);
  const colIdx = COLECOES.indexOf(colecao);
  const corTecIdx = CORES_TECIDO.indexOf(corTecido);
  const corAcabIdx = CORES_ACAB.indexOf(corAcabamento);
  if (
    famIdx < 0 || acionIdx < 0 || modeloIdx < 0 || tipoIdx < 0 ||
    colIdx < 0 || corTecIdx < 0 || corAcabIdx < 0
  ) {
    return { ok: false, reason: 'SEM_PRODUTO', limits, m2 };
  }

  const row = findRow(famIdx, acionIdx, modeloIdx, tipoIdx, colIdx, corTecIdx, corAcabIdx);
  if (!row) return { ok: false, reason: 'SEM_PRODUTO', limits, m2 };

  const vlrM2 = row[7];
  const codigo = row[8];

  const m2Cobrado = Math.max(m2, limits.m2Min);
  let motorPrice = 0;
  if (acionamento !== 'MANUAL' && motor) {
    const cor = motorColorFromAcabamento(corAcabamento);
    motorPrice = MOTOR_PRICES[motor]?.[cor] ?? 0;
  }
  const qty = quantity && quantity > 0 ? quantity : 1;
  const price = Math.round((m2Cobrado * vlrM2 + motorPrice + opcionaisTotal) * qty * 100) / 100;

  return { ok: true, price, m2, m2Cobrado, vlrM2, codigo, motorPrice, limits };
}
