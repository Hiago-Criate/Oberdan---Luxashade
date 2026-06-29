// ============================================================================
// CALCULADORA DE ORÇAMENTO - TRILHOS MOTORIZADOS TRIOFLEX
// Componentes, multiplicador e motores vêm do catálogo ATIVO (Supabase) com
// fallback nos dados estáticos abaixo.
// ============================================================================

import { getRemote } from '../data/catalogStore';
import { motorPriceFor } from './motorPrices';
import { curvaByCodigo } from '../data/trilhoCurvas';

type Comp = { c: string; q: number; f: string; v: number };

// ----- Fallback estático (dados originais) -----
export const PRODUTOS: any = {
  "255.01.01C": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. CENTRAL (PREGAS)", "componentes": [{ "c": "111.06.00", "q": 2, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)+8", "v": 0.25 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.03.01", "q": 1, "f": "", "v": 46.2 }, { "c": "155.04.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)", "v": 1.36 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.01", "q": 4, "f": "", "v": 1.94 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
  "255.01.01L": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. LATERAL (PREGAS)", "componentes": [{ "c": "111.06.00", "q": 1, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)+8", "v": 0.25 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.07.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)", "v": 1.36 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.01", "q": 2, "f": "", "v": 1.94 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
  "255.01.05C": { "descricao": "TRILHO MOTORIZADO TRIOFLEX PRETO ABERT. CENTRAL (PREGAS)", "componentes": [{ "c": "111.06.00", "q": 2, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)+8", "v": 0.25 }, { "c": "155.01.05", "q": 1, "f": "", "v": 33 }, { "c": "155.02.05", "q": 1, "f": "", "v": 18.7 }, { "c": "155.03.01", "q": 1, "f": "", "v": 46.2 }, { "c": "155.04.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)", "v": 1.46 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.05", "q": 4, "f": "", "v": 1.94 }, { "c": "155.20.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }] },
  "255.01.05L": { "descricao": "TRILHO MOTORIZADO TRIOFLEX PRETO ABERT. LATERAL (PREGAS)", "componentes": [{ "c": "111.06.00", "q": 1, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)+8", "v": 0.25 }, { "c": "155.01.05", "q": 1, "f": "", "v": 33 }, { "c": "155.02.05", "q": 1, "f": "", "v": 18.7 }, { "c": "155.07.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/100)", "v": 1.46 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.05", "q": 2, "f": "", "v": 1.94 }, { "c": "155.20.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }] },
  "255.02.01C": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. CENTRAL (MOD.MOVIMENTO)", "componentes": [{ "c": "111.06.00", "q": 2, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)+8", "v": 0.25 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.04.01", "q": 2, "f": "", "v": 36.3 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)", "v": 1.36 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.01", "q": 4, "f": "", "v": 1.94 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
  "255.02.01L": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. LATERAL (MOD.MOVIMENTO)", "componentes": [{ "c": "111.06.00", "q": 1, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)+8", "v": 0.25 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.07.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)", "v": 1.36 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.01", "q": 2, "f": "", "v": 1.94 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
  "255.02.05C": { "descricao": "TRILHO MOTORIZADO TRIOFLEX PRETO ABERT. CENTRAL (MOD.MOVIMENTO)", "componentes": [{ "c": "111.06.00", "q": 2, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)+8", "v": 0.25 }, { "c": "155.01.05", "q": 1, "f": "", "v": 33 }, { "c": "155.02.05", "q": 1, "f": "", "v": 18.7 }, { "c": "155.04.01", "q": 2, "f": "", "v": 36.3 }, { "c": "155.08.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)", "v": 1.46 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.05", "q": 4, "f": "", "v": 1.94 }, { "c": "155.20.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }] },
  "255.02.05L": { "descricao": "TRILHO MOTORIZADO TRIOFLEX PRETO ABERT. LATERAL (MOD.MOVIMENTO)", "componentes": [{ "c": "111.06.00", "q": 1, "f": "", "v": 1.98 }, { "c": "111.19.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)+8", "v": 0.25 }, { "c": "155.01.05", "q": 1, "f": "", "v": 33 }, { "c": "155.02.05", "q": 1, "f": "", "v": 18.7 }, { "c": "155.07.01", "q": 1, "f": "", "v": 36.3 }, { "c": "155.08.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.10.05", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/60)", "v": 1.46 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.17.05", "q": 2, "f": "", "v": 1.94 }, { "c": "155.20.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }] },
  "255.03.01C": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. CENTRAL (WAVE 2.4)", "componentes": [{ "c": "111.06.00", "q": 2, "f": "", "v": 1.98 }, { "c": "111.12.00", "q": 1, "f": "(AA$1+150)/1000", "v": 6.6 }, { "c": "111.14.00", "q": 1, "f": "(AA$1*2.4)/1000", "v": 15.4 }, { "c": "111.56.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/48)+2", "v": 1.49 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.05.01", "q": 2, "f": "", "v": 27.5 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.18.01", "q": 2, "f": "", "v": 2.5 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.23.00", "q": 2, "f": "", "v": 13.2 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
  "255.03.01L": { "descricao": "TRILHO MOTORIZADO TRIOFLEX BRANCO ABERT. LATERAL (WAVE 2.4)", "componentes": [{ "c": "111.06.00", "q": 1, "f": "", "v": 1.98 }, { "c": "111.12.00", "q": 1, "f": "(AA$1+150)/1000", "v": 6.6 }, { "c": "111.14.00", "q": 1, "f": "(AA$1*2.4)/1000", "v": 15.4 }, { "c": "111.56.00", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/48)+2", "v": 1.49 }, { "c": "155.02.01", "q": 1, "f": "", "v": 18.7 }, { "c": "155.05.01", "q": 1, "f": "", "v": 27.5 }, { "c": "155.08.01", "q": 1, "f": "ARREDONDAR.PARA.CIMA(AA$1/600)", "v": 3.85 }, { "c": "155.15.00", "q": 1, "f": "INT(AA$1/6001)", "v": 16.5 }, { "c": "155.18.01", "q": 1, "f": "", "v": 2.5 }, { "c": "155.19.03", "q": 1, "f": "(AA$1-100)/1000", "v": 44 }, { "c": "155.21.00", "q": 1, "f": "(AA$1*2)/1000", "v": 9.45 }, { "c": "155.22.00", "q": 1, "f": "", "v": 15.4 }, { "c": "155.27.01", "q": 1, "f": "", "v": 36 }, { "c": "155.32.00", "q": 1, "f": "", "v": 5.5 }] },
};

const FALLBACK_MODEL_MAP: Record<string, string> = {
  "Prega": "01", "Modelo movimento": "02", "Wave 2.4": "03",
  "Wave 3.4": "04", "Wave 1.7": "05", "Wave 2.7": "06",
};

// ----- Acessores do catálogo ativo -----
export function getTrilhoModelNames(): string[] {
  const r = getRemote();
  if (r && r.trilhoModelos.length) return r.trilhoModelos.map((m) => m.nome);
  return Object.keys(FALLBACK_MODEL_MAP);
}

function trilhoModelMap(): Record<string, string> {
  const r = getRemote();
  if (r && r.trilhoModelos.length) {
    const m: Record<string, string> = {};
    for (const t of r.trilhoModelos) m[t.nome] = t.codigo;
    return m;
  }
  return FALLBACK_MODEL_MAP;
}

function trilhoComponentes(codigo: string): Comp[] | null {
  const r = getRemote();
  if (r) {
    const p = r.trilhoProdutos.find((x) => x.codigo === codigo);
    return p ? (p.componentes as Comp[]) : null;
  }
  return PRODUTOS[codigo] ? (PRODUTOS[codigo].componentes as Comp[]) : null;
}

// ----- Avaliador de fórmulas (igual ao original) -----
function calcularQuantidade(formula: string, L: number, qtdBase: number) {
  if (!formula) return qtdBase;
  switch (formula) {
    case '(AA$1*2)/1000': return (L * 2) / 1000;
    case '(AA$1*2.4)/1000': return (L * 2.4) / 1000;
    case '(AA$1*2.6)/1000': return (L * 2.6) / 1000;
    case '(AA$1*3.4)/1000': return (L * 3.4) / 1000;
    case '(AA$1*1.8)/1000': return (L * 1.8) / 1000;
    case '(AA$1+150)/1000': return (L + 150) / 1000;
    case '(AA$1-100)/1000': return (L - 100) / 1000;
    case 'ARREDONDAR.PARA.CIMA(AA$1/100)': return Math.ceil(L / 100);
    case 'ARREDONDAR.PARA.CIMA(AA$1/100)+8': return Math.ceil(L / 100) + 8;
    case 'ARREDONDAR.PARA.CIMA(AA$1/48)+2': return Math.ceil(L / 48) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)': return Math.ceil(L / 60);
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)+2': return Math.ceil(L / 60) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/60)+8': return Math.ceil(L / 60) + 8;
    case 'ARREDONDAR.PARA.CIMA(AA$1/67)+2': return Math.ceil(L / 67) + 2;
    case 'ARREDONDAR.PARA.CIMA(AA$1/600)': return Math.ceil(L / 600);
    case 'INT(AA$1/6001)': return Math.floor(L / 6001);
    default: return qtdBase;
  }
}

// Valor do componente = preço unitário de venda × quantidade (pela fórmula).
// O preço unitário (comp.v) já vem com o markup de cor embutido (1,1 branco /
// 1,2 preto, conforme a planilha SG1), e a quantidade vem da fórmula sobre a
// largura — exatamente o modelo da planilha: VALOR = Σ(unit × qtd). Sem regras
// especiais nem multiplicador adicional (eram quirks que divergiam da planilha).
function calcularValorComponente(comp: Comp, larguraMM: number) {
  return comp.v * calcularQuantidade(comp.f, larguraMM, comp.q);
}

export function calculatePrice(data: any) {
  const { model, opening, railColor, width, motor, quantity } = data;

  const B = trilhoModelMap()[model] || '01';

  let C = '';
  if (railColor === 'Branco') {
    C = opening === 'Central' ? '01C' : '01L';
  } else {
    C = opening === 'Central' ? '05C' : '05L';
  }

  const codigo = `255.${B}.${C}`;
  const largura = parseInt(width);
  const qty = parseInt(quantity) || 1;

  const componentes = trilhoComponentes(codigo);
  if (!componentes) return 0;

  let baseTotal = 0;
  for (const comp of componentes) {
    baseTotal += calcularValorComponente(comp, largura);
  }

  const motorPrice = motorPriceFor(motor, railColor === 'Preto' ? 'Preto' : 'Branco');
  // Curva calandrada (opcional): valor FIXO por trilho, somado antes de × qtd.
  const curvaValor = curvaByCodigo(data.curvaCodigo)?.valor ?? 0;
  const finalPrice = (baseTotal + motorPrice + curvaValor) * qty;

  return Math.round(finalPrice * 100) / 100;
}
