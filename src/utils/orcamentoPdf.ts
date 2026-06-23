// Gera o PDF do orçamento/pedido no mesmo modelo dos PDFs do TOTVS/Protheus
// (cabeçalho da empresa → nº/emissão → bloco do cliente → tabela de itens com
// sub-linhas → totais → validade → rodapé) e devolve em base64 para enviar ao
// webhook. `buildDocDefinition` é PURO (testável); `generateOrcamentoPdf` carrega
// o pdfmake sob demanda e resolve o base64.

import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import type { Brand } from '../data/brands';
import type { OrderItem } from '../types/order';

export interface OrcamentoInput {
  tipo: 'orcamento' | 'pedido';
  marca: Brand;
  cnpj: string;
  customer: { name: string; phone: string };
  vendedor?: string | null; // vendedor da revenda (quando identificada)
  items: readonly OrderItem[]; // na ordem do carrinho
  subtotal: number; // soma dos itens (bruto)
  descontoPct: number; // % de desconto da revenda
  descontoValor: number; // valor do desconto em R$
  total: number; // subtotal − desconto (valor final)
  numero: string; // nº provisório do documento
  now: Date;
}

// Dados da empresa (do modelo fornecido). Mesma fábrica para as duas marcas;
// só troca o nome no topo. Ajustar se a ShadeXP tiver CNPJ/endereço próprios.
const EMPRESA_LINHAS = [
  'AV DONA MARIA CARDOSO QD 24 LT 04 GALPAO 02 - JARDIM LUZ',
  'CEP: 74915-175 - APARECIDA DE GOIANIA - GO',
  'Fone/Fax: 62 3094-1038   e-mail: comercial02@luxashade.com.br',
];
const EMPRESA_NOME: Record<Brand, string> = {
  luxashade: 'LUXASHADE',
  shadexp: 'SHADEXP',
};

const VALIDADE_DIAS = 5;

// ---------- formatação ----------
const fmtBRL = (n: number) =>
  (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${(n || 0).toLocaleString('pt-BR')}%`;
const fmtMm = (n: number) => (n || 0).toLocaleString('pt-BR');
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

// ---------- mapeamento de item → linhas ----------
interface ItemLinhas {
  desc: string;
  um: string;
  subs: string[];
}

function linhasDoItem(it: OrderItem): ItemLinhas {
  if (it.kind === 'shade') {
    const partes = [it.modelo, it.colecao, it.corTecido, it.corAcabamentoNome]
      .filter(Boolean)
      .join(' ');
    const lado = it.comandoLado || it.motorLado;
    const subs: string[] = [
      `L x A : ${fmtMm(it.widthMm)} x ${fmtMm(it.heightMm)} mm      Ambiente: ${it.ambiente || '-'}${
        lado ? `      Lado Com.: ${lado}` : ''
      }`,
    ];
    if (it.motor && it.motor !== 'SEM MOTOR (INFORMATIVO)') subs.push(it.motor);
    if (it.modulosAssimetricos && it.moduloLargEsqMm && it.moduloLargDirMm)
      subs.push(`Módulos: Esq. ${fmtMm(it.moduloLargEsqMm)} / Dir. ${fmtMm(it.moduloLargDirMm)} mm`);
    if (it.mesmoAmbiente) subs.push('Mesmo ambiente');
    if (it.ladoALado) subs.push(`Lado a lado${it.ladoALadoCom ? `: ${it.ladoALadoCom}` : ''}`);
    if (it.observacao) subs.push(`OBS.: ${it.observacao}`);
    return { desc: `${partes} - ${it.codigo}`, um: 'UN', subs };
  }
  if (it.kind === 'emissor') {
    const subs = [`Ambiente: ${it.ambiente || '-'}`];
    if (it.observacao) subs.push(`OBS.: ${it.observacao}`);
    return { desc: `${it.descricao} - ${it.codigo}`, um: 'PC', subs };
  }
  // trilho
  const subs: string[] = [
    `L x A : ${fmtMm(Number(it.width) || 0)} x ${fmtMm(Number(it.height) || 0)} mm      Ambiente: ${
      it.environment || '-'
    }      Abertura: ${it.opening}`,
  ];
  if (it.motor && it.motor !== 'SEM MOTOR (INFORMATIVO)')
    subs.push(`${it.motor}      Lado Motor: ${it.motorSide}`);
  if (it.curvaDescricao) subs.push(`Curva: ${it.curvaDescricao}${it.curvaCodigo ? ` (${it.curvaCodigo})` : ''}`);
  if (it.observacao) subs.push(`OBS.: ${it.observacao}`);
  return { desc: `TRILHO ${it.model}${it.railColor ? ` ${it.railColor}` : ''}`, um: 'UN', subs };
}

// ---------- documento ----------
export function buildDocDefinition(input: OrcamentoInput): TDocumentDefinitions {
  const { tipo, marca, cnpj, customer, vendedor, items, subtotal, descontoPct, descontoValor, total, numero, now } = input;
  const titulo = tipo === 'pedido' ? 'PEDIDO DE VENDA' : 'ORÇAMENTO DE VENDA';

  // Cabeçalho da tabela de itens.
  const head = (t: string, align: 'left' | 'right' | 'center' = 'left'): Content => ({
    text: t,
    style: 'th',
    alignment: align,
  });

  const body: Content[][] = [
    [head('Item', 'center'), head('Produto'), head('Quant.', 'center'), head('UM.', 'center'), head('Valor Unit.', 'right'), head('Valor Total', 'right')],
  ];

  items.forEach((it, i) => {
    const { desc, um, subs } = linhasDoItem(it);
    const qtd = it.quantity || 1;
    const valorTotal = it.price || 0;
    const valorUnit = it.kind === 'emissor' ? it.valorUnit : valorTotal / qtd;
    const produto: Content = {
      stack: [
        { text: desc, style: 'prodNome' },
        ...subs.map((s) => ({ text: s, style: 'prodSub' })),
      ],
    };
    body.push([
      { text: pad2(i + 1), alignment: 'center', style: 'cell' },
      produto,
      { text: String(qtd), alignment: 'center', style: 'cell' },
      { text: um, alignment: 'center', style: 'cell' },
      { text: fmtBRL(valorUnit), alignment: 'right', style: 'cell' },
      { text: fmtBRL(valorTotal), alignment: 'right', style: 'cell' },
    ]);
  });

  const labelVal = (label: string, value: string): Content => ({
    columns: [
      { text: label, style: 'cliLabel', width: 'auto' },
      { text: value || ' ', style: 'cliValue', width: '*' },
    ],
    columnGap: 4,
  });

  return {
    pageSize: 'A4',
    pageMargins: [32, 32, 32, 48],
    defaultStyle: { font: 'Roboto', fontSize: 8, color: '#1a1a1a' },
    footer: (currentPage, pageCount) => ({
      margin: [32, 8, 32, 0],
      columns: [
        { text: `Gerado em: ${fmtDateTime(now)}  —  ${EMPRESA_NOME[marca]} • App`, style: 'footer' },
        { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right' },
      ],
    }),
    content: [
      // Cabeçalho empresa
      { text: EMPRESA_NOME[marca], style: 'empresa' },
      ...EMPRESA_LINHAS.map((l) => ({ text: l, style: 'empresaSub' } as Content)),
      { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 531, y2: 6, lineWidth: 1, lineColor: '#111111' }] },

      // Nº + emissão
      {
        columns: [
          { text: `${titulo} Nº: ${numero}`, style: 'titulo', width: '*' },
          { text: `Emissão: ${fmtDate(now)}`, style: 'titulo', alignment: 'right', width: 'auto' },
        ],
        margin: [0, 8, 0, 6],
      },

      // Bloco do cliente
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  labelVal('Nome/Razão Social:', customer.name),
                  labelVal('CNPJ:', cnpj),
                  labelVal('Telefone:', customer.phone),
                  ...(vendedor ? [labelVal('Vendedor:', vendedor)] : []),
                ],
                margin: [6, 5, 6, 5],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
          hLineColor: () => '#bbbbbb',
          vLineColor: () => '#bbbbbb',
        },
        margin: [0, 0, 0, 8],
      },

      // Tabela de itens
      {
        table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'], body },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1 ? 0.8 : 0.4),
          vLineWidth: () => 0,
          hLineColor: (i: number) => (i <= 1 ? '#111111' : '#dddddd'),
          paddingTop: () => 4,
          paddingBottom: () => 4,
          paddingLeft: () => 3,
          paddingRight: () => 3,
        },
      },

      // Totais
      {
        margin: [0, 10, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Condição de Pgto.: ', style: 'cond' },
              { text: 'Prazo de Entrega: ', style: 'cond' },
            ],
          },
          {
            width: 'auto',
            table: {
              widths: ['auto', 'auto'],
              body: [
                [{ text: 'Subtotal:', style: 'totLbl' }, { text: `R$ ${fmtBRL(subtotal)}`, style: 'totVal' }],
                [
                  { text: descontoPct > 0 ? `(-) Desconto (${fmtPct(descontoPct)}):` : '(-) Desconto:', style: 'totLbl' },
                  { text: `R$ ${fmtBRL(descontoValor)}`, style: 'totVal' },
                ],
                [{ text: '(+) Frete:', style: 'totLbl' }, { text: `R$ ${fmtBRL(0)}`, style: 'totVal' }],
                [
                  { text: 'Total Geral:', style: 'totLblBold' },
                  { text: `R$ ${fmtBRL(total)}`, style: 'totValBold' },
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },

      {
        text: `Condições Válidas até ${fmtDate(addDays(now, VALIDADE_DIAS))}`,
        style: 'validade',
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      empresa: { fontSize: 18, bold: true, characterSpacing: 2, color: '#111111' },
      empresaSub: { fontSize: 7.5, color: '#444444', margin: [0, 0.5, 0, 0] },
      titulo: { fontSize: 10, bold: true, color: '#111111' },
      cliLabel: { fontSize: 8, bold: true, color: '#555555' },
      cliValue: { fontSize: 8, color: '#111111' },
      th: { fontSize: 8, bold: true, color: '#111111', fillColor: '#f2f2f2' },
      cell: { fontSize: 8 },
      prodNome: { fontSize: 8, bold: true, color: '#111111' },
      prodSub: { fontSize: 7.5, color: '#555555', margin: [0, 1, 0, 0] },
      cond: { fontSize: 8, color: '#333333', margin: [0, 1, 0, 0] },
      totLbl: { fontSize: 8.5, color: '#333333', alignment: 'right', margin: [0, 1, 8, 1] },
      totVal: { fontSize: 8.5, color: '#111111', alignment: 'right', margin: [0, 1, 0, 1] },
      totLblBold: { fontSize: 10, bold: true, alignment: 'right', margin: [0, 3, 8, 0] },
      totValBold: { fontSize: 10, bold: true, alignment: 'right', margin: [0, 3, 0, 0] },
      validade: { fontSize: 8, italics: true, color: '#444444' },
      footer: { fontSize: 7, color: '#888888' },
    },
  };
}

// Carrega o pdfmake sob demanda (mantém o bundle principal leve) e configura as
// fontes (vfs). Tolerante às variações de shape do vfs_fonts entre versões:
// pode vir como { pdfMake: { vfs } }, { vfs } ou o próprio mapa de fontes.
async function loadPdfMake(): Promise<any> {
  const mod: any = await import('pdfmake/build/pdfmake');
  const fontsMod: any = await import('pdfmake/build/vfs_fonts');
  const pdfMake = mod.default ?? mod;
  const raw = fontsMod.default ?? fontsMod;
  pdfMake.vfs = raw.pdfMake?.vfs ?? raw.vfs ?? raw;
  return pdfMake;
}

export interface OrcamentoPdf {
  filename: string;
  mimeType: 'application/pdf';
  base64: string;
}

export async function generateOrcamentoPdf(input: OrcamentoInput): Promise<OrcamentoPdf> {
  const pdfMake = await loadPdfMake();
  const docDef = buildDocDefinition(input);
  const base64: string = await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBase64((data: string) => resolve(data));
    } catch (e) {
      reject(e);
    }
  });
  const prefixo = input.tipo === 'pedido' ? 'pedido' : 'orcamento';
  return { filename: `${prefixo}-${input.numero}.pdf`, mimeType: 'application/pdf', base64 };
}
