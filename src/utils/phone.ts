// ============================================================================
// Telefone do cliente, no formato que o envio no WhatsApp (ZPro/appback) exige.
//
// O número vai CRU para a API (o n8n repassa `customer.phone` direto em
// `number`), então quem tem que acertar o formato é o app.
//
// REGRA DO 9º DÍGITO (WhatsApp Brasil):
//   • DDD 11 a 30  (SP, RJ, ES)      -> celular COM o 9   (9 dígitos)
//       (11) 95088-4863  ->  5511950884863
//   • DDD 31 a 99  (demais estados)  -> celular SEM o 9   (8 dígitos)
//       (62) 99159-2150  ->  556291592150
//
// O 9º dígito foi implantado por região em anos diferentes, e o WhatsApp
// registrou os números conforme a implantação: onde veio cedo (11–30) o 9 ficou
// no cadastro, onde veio depois (31+) não. A própria tabela `revendas` segue
// exatamente isso (SP com 9, GO sem 9), então a regra abaixo bate com o dado
// real. Confirmado em 2026-09-02 com a Lília: (11) 95088-4863 só entrega COM
// o 9, e (62) …. só entrega SEM.
//
// Telefone FIXO (assinante começa em 2..5) tem 8 dígitos e fica fora da regra.
//
// A pessoa digita do jeito natural dela (com ou sem o 9, com ou sem o 55) e a
// normalização entrega o formato certo para o DDD dela.
// ============================================================================

export interface PhoneParse {
  ok: boolean;
  ddd: string;
  /** Assinante já no formato do envio: 9 dígitos (DDD 11–30) ou 8 (DDD 31+). */
  assinante: string;
  /** O que vai para o WhatsApp: 55 + DDD + assinante. '' se inválido. */
  envio: string;
  /** Máscara amigável do que foi digitado: (11) 95088-4863 */
  display: string;
  /** true quando o 9 inicial foi RETIRADO (DDD 31+). */
  removeuNove: boolean;
  /** Orientação para o usuário quando ainda não está válido. */
  aviso: string;
}

export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

/** DDDs que mantêm o 9º dígito no WhatsApp (SP, RJ, ES). */
export const usaNoveDigito = (ddd: number | string): boolean => {
  const n = Number(ddd);
  return n >= 11 && n <= 30;
};

// Dígitos da parte nacional (DDD + assinante), já sem o DDI.
// O 55 só é tratado como DDI quando o número tem tamanho de número completo
// (>= 12), senão "55" seria confundido com o DDD 55 (RS).
function nacional(input: string): string {
  let d = onlyDigits(input);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

/** Máscara de digitação: (62) 9159-2150 / (11) 95088-4863 */
export function maskPhoneBR(input: string): string {
  const d = nacional(input);
  if (!d) return '';
  const ddd = d.slice(0, 2);
  const sub = d.slice(2);
  if (d.length <= 2) return `(${ddd}`;
  if (sub.length <= 4) return `(${ddd}) ${sub}`;
  if (sub.length <= 8) return `(${ddd}) ${sub.slice(0, 4)}-${sub.slice(4)}`;
  return `(${ddd}) ${sub.slice(0, 5)}-${sub.slice(5, 9)}`;
}

export function parsePhoneBR(input: string): PhoneParse {
  const d = nacional(input);
  const ddd = d.slice(0, 2);
  let sub = d.slice(2);
  let removeuNove = false;

  const comNove = usaNoveDigito(ddd);

  // Nos DDDs 31+ o WhatsApp usa o número sem o 9 inicial.
  if (!comNove && sub.length === 9 && sub.startsWith('9')) {
    sub = sub.slice(1);
    removeuNove = true;
  }

  // Quantos dígitos o assinante deve ter no envio, para este DDD.
  // NÃO acrescentamos o 9 sozinhos nos DDDs 11–30: com 8 dígitos é impossível
  // saber se falta o 9 ou se é um fixo (ex.: 5088-4863 pode ser os dois), e
  // chutar mandaria o orçamento para outra pessoa. Preferimos orientar.
  const esperado = comNove ? 9 : 8;

  const base: PhoneParse = {
    ok: false, ddd, assinante: sub, envio: '',
    display: maskPhoneBR(input), removeuNove, aviso: '',
  };

  if (!d.length) return base;
  if (d.length < 3) return { ...base, aviso: 'Digite o DDD e o número.' };
  if (Number(ddd) < 11) return { ...base, aviso: 'DDD inválido, comece pelo DDD (ex.: 11 ou 62).' };

  if (sub.length < esperado) {
    if (comNove && sub.length === 8) {
      return { ...base, aviso: `No DDD ${ddd} o celular tem 9 dígitos: comece com 9.` };
    }
    const n = esperado - sub.length;
    return { ...base, aviso: n === 1 ? 'Falta 1 dígito do número.' : `Faltam ${n} dígitos do número.` };
  }
  if (sub.length > esperado) return { ...base, aviso: 'Número com dígitos demais, confira.' };

  return { ...base, ok: true, envio: `55${ddd}${sub}` };
}

/** Texto do número final, para confirmação visual: +55 11 95088-4863 */
export function envioLegivel(p: PhoneParse): string {
  if (!p.ok) return '';
  const s = p.assinante;
  const meio = s.length === 9 ? `${s.slice(0, 5)}-${s.slice(5)}` : `${s.slice(0, 4)}-${s.slice(4)}`;
  return `+55 ${p.ddd} ${meio}`;
}
