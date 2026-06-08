// Helpers de cascata para os dropdowns. Agora leem do catálogo ATIVO
// (Supabase com fallback estático) via catalogStore. Mesmas assinaturas de antes.

import {
  activeProducts,
  familiasList,
  acionamentosList,
  modelosList,
  tiposList,
  colecoesList,
  coresTecidoList,
  coresAcabList,
  orderByDict,
} from './catalogStore';

export const familias = (): readonly string[] => familiasList();

export const acionamentosFor = (familia: string): readonly string[] => {
  if (!familia) return [];
  const vals = activeProducts().filter((p) => p.familia === familia).map((p) => p.acionamento);
  return orderByDict(vals, acionamentosList());
};

export const modelosFor = (familia: string, acionamento: string): readonly string[] => {
  if (!familia || !acionamento) return [];
  const vals = activeProducts()
    .filter((p) => p.familia === familia && p.acionamento === acionamento)
    .map((p) => p.modelo);
  return orderByDict(vals, modelosList());
};

export const tiposFor = (
  familia: string,
  acionamento: string,
  modelo: string,
): readonly string[] => {
  if (!familia || !acionamento || !modelo) return [];
  const vals = activeProducts()
    .filter((p) => p.familia === familia && p.acionamento === acionamento && p.modelo === modelo)
    .map((p) => p.tipo);
  return orderByDict(vals, tiposList());
};

export const colecoesFor = (modelo: string, tipo: string): readonly string[] => {
  if (!modelo || !tipo) return [];
  const vals = activeProducts()
    .filter((p) => p.modelo === modelo && p.tipo === tipo)
    .map((p) => p.colecao);
  return orderByDict(vals, colecoesList());
};

export const coresTecidoFor = (modelo: string, colecao: string): readonly string[] => {
  if (!modelo || !colecao) return [];
  const vals = activeProducts()
    .filter((p) => p.modelo === modelo && p.colecao === colecao)
    .map((p) => p.corTecido);
  return orderByDict(vals, coresTecidoList());
};

export const coresAcabamentoFor = (
  modelo: string,
  colecao: string,
  corTecido: string,
): readonly string[] => {
  if (!modelo || !colecao || !corTecido) return [];
  const vals = activeProducts()
    .filter((p) => p.modelo === modelo && p.colecao === colecao && p.corTecido === corTecido)
    .map((p) => p.corAcab);
  return orderByDict(vals, coresAcabList());
};
