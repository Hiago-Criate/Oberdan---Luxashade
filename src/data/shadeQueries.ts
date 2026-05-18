// Helpers que transformam os índices em listas de strings prontas para a UI.
// As funções recebem os nomes em string (camada externa) e devolvem strings.

import {
  ACIONAMENTOS,
  ACION_BY_FAM,
  COL_BY_MODELO_TIPO,
  COR_ACAB_BY_MODELO_COL_COR_TEC,
  COR_TEC_BY_MODELO_COL,
  COLECOES,
  CORES_ACAB,
  CORES_TECIDO,
  FAMILIAS,
  MODELOS,
  MODELO_BY_FAM_ACION,
  TIPOS_TECIDO,
  TIPO_BY_FAM_ACION_MODELO,
} from './shadeCatalog';

export const familias = (): readonly string[] => FAMILIAS;

export const acionamentosFor = (familia: string): readonly string[] => {
  const fi = FAMILIAS.indexOf(familia);
  if (fi < 0) return [];
  return (ACION_BY_FAM[fi] ?? []).map((i) => ACIONAMENTOS[i]);
};

export const modelosFor = (familia: string, acionamento: string): readonly string[] => {
  const fi = FAMILIAS.indexOf(familia);
  const ai = ACIONAMENTOS.indexOf(acionamento);
  if (fi < 0 || ai < 0) return [];
  return (MODELO_BY_FAM_ACION[`${fi}|${ai}`] ?? []).map((i) => MODELOS[i]);
};

export const tiposFor = (
  familia: string,
  acionamento: string,
  modelo: string,
): readonly string[] => {
  const fi = FAMILIAS.indexOf(familia);
  const ai = ACIONAMENTOS.indexOf(acionamento);
  const mi = MODELOS.indexOf(modelo);
  if (fi < 0 || ai < 0 || mi < 0) return [];
  return (TIPO_BY_FAM_ACION_MODELO[`${fi}|${ai}|${mi}`] ?? []).map((i) => TIPOS_TECIDO[i]);
};

export const colecoesFor = (modelo: string, tipo: string): readonly string[] => {
  const mi = MODELOS.indexOf(modelo);
  const ti = TIPOS_TECIDO.indexOf(tipo);
  if (mi < 0 || ti < 0) return [];
  return (COL_BY_MODELO_TIPO[`${mi}|${ti}`] ?? []).map((i) => COLECOES[i]);
};

export const coresTecidoFor = (modelo: string, colecao: string): readonly string[] => {
  const mi = MODELOS.indexOf(modelo);
  const ci = COLECOES.indexOf(colecao);
  if (mi < 0 || ci < 0) return [];
  return (COR_TEC_BY_MODELO_COL[`${mi}|${ci}`] ?? []).map((i) => CORES_TECIDO[i]);
};

export const coresAcabamentoFor = (
  modelo: string,
  colecao: string,
  corTecido: string,
): readonly string[] => {
  const mi = MODELOS.indexOf(modelo);
  const ci = COLECOES.indexOf(colecao);
  const cti = CORES_TECIDO.indexOf(corTecido);
  if (mi < 0 || ci < 0 || cti < 0) return [];
  return (COR_ACAB_BY_MODELO_COL_COR_TEC[`${mi}|${ci}|${cti}`] ?? []).map(
    (i) => CORES_ACAB[i],
  );
};
