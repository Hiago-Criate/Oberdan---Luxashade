// Campo de medida em MILÍMETROS, usado em todas as medidas do app (larguras,
// alturas, módulos, altura do comando).
//
// A revenda digitou "4,47" (metros) num trilho, o app leu 4 mm e o preço saiu
// ~80% menor, sem aviso. Pedido do gestor de vendas: sempre milímetros; se
// digitar vírgula ou ponto, avisar que parece metros e corrigir. (23/10/2026)
//
// Por que não simplesmente ignorar a tecla da vírgula: quem digita "4,47"
// ficaria com "447", ou seja 447 mm, o mesmo erro só que escondido. Então o
// campo ENTENDE a vírgula/ponto (regra em utils/medidaMm), avisa, e já entrega
// ao resto do app o valor certo em mm, enquanto a pessoa digita. Ao sair do
// campo, o texto também vira o número em mm: no fim, nunca sobra vírgula nem
// ponto. Orçamento antigo reaberto com vírgula é corrigido do mesmo jeito.

import { useEffect, useState } from 'react';
import { interpretarMm, fmtMm, type Medida } from '../utils/medidaMm';

interface Props {
  /** Valor em mm, só dígitos ('' = vazio). É o que o resto do app usa. */
  value: string;
  onChange: (mm: string) => void;
  placeholder?: string;
  className?: string;
  /** Avisa (sem travar) quando o número, sem vírgula, for menor que isto:
   *  num trilho, "4" quase sempre quer dizer 4 metros. Usar onde não existe
   *  mínimo próprio (nas cortinas o app já mostra o mínimo do modelo). */
  avisarAbaixoDe?: number;
}

interface Nota { de: string; mm: number; tipo: 'metros' | 'decimal' }

const separador = /[.,]/;
const paraPai = (m: Medida) => (m.mm != null ? String(m.mm) : '');

export function CampoMm({ value, onChange, placeholder = '0', className, avisarAbaixoDe }: Props) {
  const [texto, setTexto] = useState(String(value ?? ''));
  const [nota, setNota] = useState<Nota | null>(null);

  // Acompanha mudanças que vêm de fora (abrir item salvo, duplicar, reabrir
  // orçamento). Valor antigo com vírgula/ponto é corrigido e avisado aqui.
  useEffect(() => {
    const externo = String(value ?? '');
    const m = interpretarMm(externo);
    if (separador.test(externo) && (m.tipo === 'metros' || m.tipo === 'decimal')) {
      setTexto(String(m.mm));
      setNota({ de: externo, mm: m.mm as number, tipo: m.tipo });
      onChange(String(m.mm));
      return;
    }
    if (m.mm !== interpretarMm(texto).mm) {
      setTexto(m.mm != null ? String(m.mm) : externo);
      setNota(null);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoDigitar = (bruto: string) => {
    const limpo = bruto.replace(/[^\d.,]/g, '');   // letras e espaços nem entram
    setTexto(limpo);
    setNota(null);
    onChange(paraPai(interpretarMm(limpo)));
  };

  const aoSair = () => {
    const m = interpretarMm(texto);
    if (m.tipo === 'metros' || m.tipo === 'decimal') {
      setNota({ de: texto, mm: m.mm as number, tipo: m.tipo });
      setTexto(String(m.mm));
    } else if (m.tipo === 'ok' && texto !== String(m.mm)) {
      setTexto(String(m.mm));   // tira zero à esquerda
    }
  };

  const atual = interpretarMm(texto);
  let aviso: { cor: 'ambar' | 'vermelho'; texto: string } | null = null;
  if (atual.tipo === 'metros') {
    aviso = { cor: 'ambar', texto: `Parece que você digitou em metros: ${texto} m = ${fmtMm(atual.mm as number)} mm. Vamos usar ${fmtMm(atual.mm as number)} mm.` };
  } else if (atual.tipo === 'decimal') {
    aviso = { cor: 'ambar', texto: `A medida é em milímetros, sem vírgula. Vamos usar ${fmtMm(atual.mm as number)} mm.` };
  } else if (atual.tipo === 'invalido') {
    aviso = { cor: 'vermelho', texto: 'Digite só números, em milímetros (ex: 4470).' };
  } else if (nota) {
    aviso = {
      cor: 'ambar',
      texto: nota.tipo === 'metros'
        ? `Corrigido: ${nota.de} parecia metros, ficou ${fmtMm(nota.mm)} mm.`
        : `Arredondado para ${fmtMm(nota.mm)} mm (a medida é em milímetros, sem vírgula).`,
    };
  } else if (avisarAbaixoDe && atual.tipo === 'ok' && atual.mm != null && atual.mm > 0 && atual.mm < avisarAbaixoDe) {
    aviso = {
      cor: 'ambar',
      texto: `Confira: ${fmtMm(atual.mm)} mm é muito pouco. A medida é em milímetros: ${fmtMm(atual.mm)} m seriam ${fmtMm(atual.mm * 1000)} mm.`,
    };
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
        onBlur={aoSair}
        className={className}
      />
      {aviso && (
        <p className={aviso.cor === 'vermelho'
          ? 'text-[11px] leading-snug text-red-500'
          : 'text-[11px] leading-snug text-amber-700'}>
          {aviso.texto}
        </p>
      )}
    </>
  );
}
