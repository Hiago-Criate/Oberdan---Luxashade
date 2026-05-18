// Tabela compartilhada de motores entre o fluxo de TRILHO e o fluxo de SHADE.
// Preço em BRL, separado por cor do trilho/acabamento.

export type MotorPriceTable = Record<string, { Branco: number; Preto: number }>;

export const MOTOR_PRICES: MotorPriceTable = {
  'MOTOR SOMFY GLYDEA ULTRA 60E RTS': { Branco: 4353, Preto: 4320 },
  'MOTOR SOMFY GLYDEA ULTRA 60E W CONTATO SECO': { Branco: 3703, Preto: 3670 },
  'MOTOR SOMFY ELATIO 50KG W CONTATO SECO': { Branco: 1683, Preto: 1650 },
  'MOTOR SOMFY ELATIO 50KG RTS': { Branco: 1683, Preto: 1650 },
  'MOTOR IVOLVE IV50 N2 W CONTATO SECO': { Branco: 1023, Preto: 990 },
  'MOTOR IVOLVE IV60 N1 RF + WI-FI': { Branco: 691.5, Preto: 650 },
  'SEM MOTOR (INFORMATIVO)': { Branco: 0, Preto: 0 },
};

export const MOTORS: readonly string[] = Object.keys(MOTOR_PRICES);
