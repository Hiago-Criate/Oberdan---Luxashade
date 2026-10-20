// Envio ao n8n (que manda o PDF por WhatsApp) com novas tentativas automáticas.
//
// O webhook responde "recebi" ANTES de mandar a mensagem, então uma falha aqui
// nunca é do telefone do cliente: é rede (internet de quem envia, ou o servidor
// fora por um instante). Problema típico de segundos, que se resolve tentando
// de novo. Antes era uma tentativa só, e um soluço de rede virava "Erro ao
// enviar orçamento" na tela da revenda. (GEHDECOR, 16/10/2026)
//
//   • sem resposta (rede caiu, timeout) ou 5xx  -> espera e tenta de novo
//   • 4xx (o servidor recusou o conteúdo)        -> repetir não muda nada, desiste
//
// Raro efeito colateral: se a 1ª chegou ao n8n e só a RESPOSTA se perdeu, o
// cliente recebe o PDF duas vezes. Bem melhor que achar que nada foi enviado.

import axios from 'axios';

export const ENVIO_TENTATIVAS = 3;
export const ENVIO_TIMEOUT_MS = 30_000;

export interface EnvioOpcoes {
  tentativas?: number;
  timeoutMs?: number;
  /** Espera antes da tentativa n+1, em ms. Padrão: 1,5 s, 3 s. */
  espera?: (n: number) => number;
  onTentativa?: (n: number) => void;
}

export async function enviarComRetentativas(
  url: string, payload: unknown, opcoes: EnvioOpcoes = {},
): Promise<void> {
  const tentativas = opcoes.tentativas ?? ENVIO_TENTATIVAS;
  const timeout = opcoes.timeoutMs ?? ENVIO_TIMEOUT_MS;
  const espera = opcoes.espera ?? ((n: number) => 1500 * n);
  let ultimoErro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    opcoes.onTentativa?.(i);
    try {
      await axios.post(url, payload, { timeout });
      return;
    } catch (e) {
      ultimoErro = e;
      const status = (e as any)?.response?.status as number | undefined;
      if (status && status >= 400 && status < 500) break;
      if (i < tentativas) await new Promise((r) => setTimeout(r, espera(i)));
    }
  }
  throw ultimoErro;
}
