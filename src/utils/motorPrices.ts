// Tabela compartilhada de motores entre o fluxo de TRILHO e o fluxo de SHADE.
// Preço em BRL, separado por cor do trilho/acabamento.

export type MotorPriceTable = Record<string, { Branco: number; Preto: number }>;

// Motores do TRILHO MOTORIZADO (Luxashade).
export const MOTOR_PRICES: MotorPriceTable = {
  'MOTOR SOMFY GLYDEA ULTRA 60E RTS': { Branco: 4353, Preto: 4320 },
  'MOTOR SOMFY GLYDEA ULTRA 60E W CONTATO SECO': { Branco: 3703, Preto: 3670 },
  'MOTOR SOMFY ELATIO 50KG W CONTATO SECO': { Branco: 1683, Preto: 1650 },
  'MOTOR SOMFY ELATIO 50KG RTS': { Branco: 1683, Preto: 1650 },
  'MOTOR IVOLVE IV50 N2 W CONTATO SECO': { Branco: 1023, Preto: 990 },
  'MOTOR IVOLVE IV60 N1 RF + WI-FI': { Branco: 691.5, Preto: 650 },
  // Motores das cortinas ShadeXP (preço único — mesma cor paga igual).
  'IVOLVE IV35RE RF+WI-FI 6/28 220V': { Branco: 890, Preto: 890 },
  'IVOLVE IV35RE RF+WI-FI 6/33 110V': { Branco: 890, Preto: 890 },
  'SOMFY LSN 6/33 RTS 220V': { Branco: 1298, Preto: 1298 },
  'SOMFY LSN 6/33 RTS 110V': { Branco: 1298, Preto: 1298 },
  'SEM MOTOR (INFORMATIVO)': { Branco: 0, Preto: 0 },
};

// Lista de motores para o TRILHO (Luxashade).
export const MOTORS: readonly string[] = [
  'MOTOR SOMFY GLYDEA ULTRA 60E RTS',
  'MOTOR SOMFY GLYDEA ULTRA 60E W CONTATO SECO',
  'MOTOR SOMFY ELATIO 50KG W CONTATO SECO',
  'MOTOR SOMFY ELATIO 50KG RTS',
  'MOTOR IVOLVE IV50 N2 W CONTATO SECO',
  'MOTOR IVOLVE IV60 N1 RF + WI-FI',
];

// Motores das cortinas ShadeXP — todos os modelos motorizados.
export const SXP_SHADE_MOTORS: readonly string[] = [
  'IVOLVE IV35RE RF+WI-FI 6/28 220V',
  'IVOLVE IV35RE RF+WI-FI 6/33 110V',
  'SOMFY LSN 6/33 RTS 220V',
  'SOMFY LSN 6/33 RTS 110V',
];
