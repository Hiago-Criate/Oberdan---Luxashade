// Entende o que a pessoa digitou num campo de medida e devolve o valor em MILÍMETROS.
//
// Por que existe: a revenda digitou "4,47" (metros) na largura de um trilho, o
// app leu 4 mm e o preço saiu ~80% menor, sem aviso nenhum. O gestor de vendas
// pediu: sempre milímetros; se vier vírgula ou ponto, avisar e corrigir.
// (23/10/2026)
//
// Regra:
//   • só dígitos ............ já é mm                  "4470"   -> 4470 (ok)
//   • com vírgula/ponto e < 100 ... era METROS, × 1000  "4,47"   -> 4470 (metros)
//   • com vírgula/ponto e ≥ 100 ... mm com decimal       "447,5"  -> 448  (decimal)
//   • não dá para entender ................................ "4,4,4"  -> invalido
//
// Por que 100: nenhuma medida real em mm é menor que 10 cm, então um número
// pequeno com vírgula só pode ser metros. E "4.470" (ponto de milhar) cai aqui
// como 4,47 m = 4470 mm, o mesmo resultado: não há ambiguidade a resolver.

export type TipoMedida = 'vazio' | 'ok' | 'metros' | 'decimal' | 'invalido';

// Interface simples (sem união discriminada): o projeto compila com
// strictNullChecks desligado, e assim não depende de estreitamento de tipo.
export interface Medida {
  tipo: TipoMedida;
  mm: number | null;
}

const contar = (s: string, c: string) => s.split(c).length - 1;

export function interpretarMm(texto: string): Medida {
  const limpo = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!/\d/.test(limpo)) return { tipo: 'vazio', mm: null };
  if (!/[.,]/.test(limpo)) return { tipo: 'ok', mm: parseInt(limpo, 10) };

  const virgulas = contar(limpo, ','), pontos = contar(limpo, '.');
  if (virgulas > 1) return { tipo: 'invalido', mm: null };

  let normal: string;
  if (virgulas === 1) {
    // Padrão brasileiro: ponto é milhar, vírgula é decimal ("1.250,5").
    normal = limpo.replace(/\./g, '').replace(',', '.');
  } else {
    // Só pontos: um é decimal ("4.47"); vários são milhar ("1.250.000").
    normal = pontos > 1 ? limpo.replace(/\./g, '') : limpo;
  }

  const n = parseFloat(normal);
  if (!isFinite(n)) return { tipo: 'invalido', mm: null };
  if (n === 0) return { tipo: 'vazio', mm: null };   // "0," enquanto digita "0,8"
  if (n < 100) {
    const mm = Math.round(n * 1000);
    return mm > 0 ? { tipo: 'metros', mm } : { tipo: 'invalido', mm: null };
  }
  return { tipo: 'decimal', mm: Math.round(n) };
}

export const fmtMm = (mm: number) => mm.toLocaleString('pt-BR');
