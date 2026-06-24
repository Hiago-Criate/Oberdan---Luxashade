// TABELA PESO (KG) do trilho motorizado — regras da Lília (trilhos.txt).
// Valida a LARGURA MÁXIMA viável e o PESO MÁXIMO da cortina, por perfil de motor
// × tipo de trilho (reto / 1 curva 90° / curva contínua / 2 curvas 90°).
// Self-contained (o trilho fica fora do get_catalog).

export type CurvaTipo = 'reto' | '1curva' | 'continua' | '2curvas';
export type PerfilMotor = '50KG' | '60KG';

interface Banda { m: number; kg: number | null } // kg=null → "não disponível"

// IVOLVE (IV60/IV50) e SOMFY Elatio compartilham a tabela 50KG; Glydea = 60KG.
const TABELA: Record<PerfilMotor, Record<CurvaTipo, Banda[]>> = {
  '50KG': {
    reto:      [{ m: 2, kg: 55 }, { m: 4, kg: 45 }, { m: 6, kg: 40 }, { m: 8, kg: 35 }, { m: 10, kg: 25 }],
    '1curva':  [{ m: 2, kg: 45 }, { m: 4, kg: 35 }, { m: 6, kg: 30 }, { m: 8, kg: 25 }, { m: 10, kg: null }],
    continua:  [{ m: 2, kg: 45 }, { m: 4, kg: 35 }, { m: 6, kg: 30 }, { m: 8, kg: 25 }, { m: 10, kg: null }],
    '2curvas': [{ m: 2, kg: 35 }, { m: 4, kg: 30 }, { m: 6, kg: 25 }, { m: 8, kg: null }, { m: 10, kg: null }],
  },
  '60KG': {
    reto:      [{ m: 8, kg: 60 }, { m: 10, kg: 60 }, { m: 11, kg: 55 }, { m: 13, kg: 50 }, { m: 15, kg: 45 }],
    '1curva':  [{ m: 8, kg: 60 }, { m: 10, kg: 50 }, { m: 11, kg: 45 }, { m: 13, kg: 40 }, { m: 15, kg: null }],
    continua:  [{ m: 8, kg: 60 }, { m: 10, kg: 50 }, { m: 11, kg: 45 }, { m: 13, kg: 40 }, { m: 15, kg: null }],
    '2curvas': [{ m: 8, kg: 50 }, { m: 10, kg: 40 }, { m: 11, kg: 30 }, { m: 13, kg: null }, { m: 15, kg: null }],
  },
};

export const LARGURA_MAX_TRILHO_MM = 15000;

export function perfilMotor(nome: string): PerfilMotor {
  return /GLYDEA/i.test(nome) ? '60KG' : '50KG';
}
export function isIvolveIV60(nome: string): boolean {
  return /IV60/i.test(nome);
}

export function curvaTipo(curvaCodigo?: string | null): CurvaTipo {
  switch (curvaCodigo) {
    case '154.27.00': return '1curva';
    case '154.28.00': return '2curvas';
    case '154.29.00':
    case '154.30.00': return 'continua';
    default: return 'reto';
  }
}

// Maior largura (m) viável p/ perfil+curva = maior banda com kg != null.
export function larguraMaxM(perfil: PerfilMotor, curva: CurvaTipo): number {
  let max = 0;
  for (const b of TABELA[perfil][curva]) if (b.kg != null) max = b.m;
  return max;
}

// Peso máximo da cortina (kg) para uma largura: a 1ª banda que cobre a largura.
// null = largura acima do máximo (não fabricável).
export function pesoMaxKg(perfil: PerfilMotor, curva: CurvaTipo, larguraMm: number): number | null {
  const larguraM = larguraMm / 1000;
  for (const b of TABELA[perfil][curva]) {
    if (larguraM <= b.m) return b.kg;
  }
  return null;
}

export interface Viabilidade {
  ok: boolean;
  pesoMaxKg: number | null; // peso máx da cortina (informativo)
  larguraMaxM: number;      // largura máx viável p/ esse motor+curva
}

// Valida um motor específico para a largura + curva escolhidas.
export function validarTrilho(motorNome: string, curvaCodigo: string | null | undefined, larguraMm: number): Viabilidade {
  const perfil = perfilMotor(motorNome);
  const curva = curvaTipo(curvaCodigo);
  const larguraMaxM_ = larguraMaxM(perfil, curva);
  const peso = pesoMaxKg(perfil, curva, larguraMm);
  const ok = larguraMm > 0 && (larguraMm / 1000) <= larguraMaxM_ && peso != null;
  return { ok, pesoMaxKg: peso, larguraMaxM: larguraMaxM_ };
}

// Motores viáveis para o trilho: filtra a lista pelos que conseguem fabricar
// aquela largura+curva (tabela peso) e pela cor (IV60 não vai em trilho PRETO).
export function motorsForTrilho(
  motores: readonly string[],
  larguraMm: number,
  curvaCodigo: string | null | undefined,
  cor: string,
): string[] {
  return motores.filter((nome) => {
    if (cor === 'Preto' && isIvolveIV60(nome)) return false;
    if (larguraMm > 0 && !validarTrilho(nome, curvaCodigo, larguraMm).ok) return false;
    return true;
  });
}
