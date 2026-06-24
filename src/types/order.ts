// Modelo unificado de item no carrinho. União discriminada por `kind`.

import type { Brand } from '../data/brands';

export interface TrilhoItem {
  kind: 'trilho';
  id: string;
  brand: Brand;
  productCategory: 'Trilho';
  model: string;
  environment: string;
  quantity: number;
  width: string;
  height: string;
  opening: string;
  railColor: string;
  motorSide: string;
  motor: string;
  // Curva calandrada (opcional do trilho). Vazio = trilho reto. Valor fixo × qtd.
  curvaCodigo?: string;
  curvaDescricao?: string;
  curvaValor?: number;
  // Tipo de fixação (Teto / Kit Suporte Parede 1 ou 2 trilhos). Informativo —
  // o preço dos kits virá com a planilha de acessórios.
  fixacao?: string;
  // Validação da tabela peso: peso máx da cortina (informativo) + prazo de produção.
  pesoMaxKg?: number | null;
  prazoDias?: number;
  // Observação livre da revenda (campo OBS de cada item do pedido).
  observacao?: string;
  price: number;
}

export interface OpcionalEscolhido {
  codigo: string;
  descricao: string;
  formula: 'fixo' | 'porLargura' | 'porAltura' | 'porAltComando';
  valorUnit: number;
  valor: number; // total cobrado por peça (já considerando largura/altura/comando)
}

export interface ShadeItem {
  kind: 'shade';
  id: string;
  brand: Brand;
  productCategory: 'Cortina';
  familia: string;
  acionamento: string;
  modelo: string;
  ambiente: string;
  tipoTecido: string;
  colecao: string;
  corTecido: string;
  corAcabamento: string;
  corAcabamentoNome: string; // 'Branco' | 'Bege' | 'Cinza' | 'Preto'
  motor: string;             // 'SEM MOTOR (INFORMATIVO)' se MANUAL
  widthMm: number;
  heightMm: number;
  quantity: number;
  // Lado do comando (manual) ou do motor (motorizada). Pode ser
  // 'Direita' | 'Esquerda' | 'Dir./Esq.' (este último para DUPLA/DAYNIGHT).
  comandoLado?: string;       // só quando acionamento === 'MANUAL'
  comandoAlturaMm?: number;   // só MANUAL
  motorLado?: string;         // só quando acionamento !== 'MANUAL'
  // Módulos (produtos "DUPLA"). Se assimétrico, informa largura de cada módulo.
  modulosAssimetricos?: boolean;
  moduloLargEsqMm?: number;
  moduloLargDirMm?: number;
  // Instalação: alinhamento com outras peças do pedido.
  mesmoAmbiente?: boolean;
  ladoALado?: boolean;
  ladoALadoCom?: string;
  // Observação livre da revenda (campo OBS de cada item do pedido).
  observacao?: string;
  // Acessórios opcionais (ShadeXP). Já listados com o total unitário.
  opcionais?: OpcionalEscolhido[];
  opcionaisTotal?: number;
  codigo: string;            // ex. 298.01.111
  m2: number;
  m2Cobrado: number;         // max(m2, m2Min) usado no cálculo
  vlrM2: number;
  price: number;             // total da peça × quantity (já com opcionais)
}

// Emissor / controle remoto. Item independente: a revenda escolhe a marca do
// motor (Somfy/Ivolve), o emissor disponível para a marca da cortina, a
// quantidade e identifica na observação em qual canal cada peça é programada.
export interface EmissorItem {
  kind: 'emissor';
  id: string;
  brand: Brand;
  productCategory: 'Emissor';
  ambiente: string;
  motorBrand: string; // marca do motor (SOMFY, IVOLVE, … — extensível)
  codigo: string;
  descricao: string;
  canais: number;
  quantity: number;
  valorUnit: number;
  // Observação: canal de cada item (ex: "Item 01 → canal 3; Item 02 → canal 1").
  observacao?: string;
  price: number; // valorUnit × quantity
}

export type OrderItem = TrilhoItem | ShadeItem | EmissorItem;

// Mapeamento cód -> nome legível da cor de acabamento.
export const COR_ACAB_NOMES: Record<string, string> = {
  '01': 'Branco',
  '02': 'Bege',
  '03': 'Cinza',
  '05': 'Preto',
  // Variantes sem zero à esquerda (algumas linhas da planilha).
  '1': 'Branco',
  '2': 'Bege',
  '3': 'Cinza',
  '5': 'Preto',
};

// Cor do trilho/acabamento usada no MOTOR_PRICES (Branco/Preto). Default = Branco.
export function motorColorFromAcabamento(cod: string): 'Branco' | 'Preto' {
  return cod === '05' || cod === '5' ? 'Preto' : 'Branco';
}
