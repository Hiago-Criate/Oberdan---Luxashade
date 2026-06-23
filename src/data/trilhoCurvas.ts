// Curvas calandradas do trilho motorizado Trioflex — opcional do trilho.
// Lista ESTÁTICA (self-contained): o trilho fica fora do get_catalog/RPC, então
// os opcionais do trilho moram aqui. Fonte: tabela "Trilhos Motorizados Trioflex
// v007" (Lília, 01Jun26), coluna PRECO 1. Valor FIXO por trilho (× quantidade).

export interface CurvaTrilho {
  codigo: string;
  descricao: string;
  valor: number; // R$ fixo (PRECO 1 da tabela)
}

export const CURVAS_TRILHO: readonly CurvaTrilho[] = [
  { codigo: '154.27.00', descricao: '1 Curva Calandrada 90°', valor: 423.5 },
  { codigo: '154.28.00', descricao: '2 Curvas Calandradas 90°', valor: 726 },
  { codigo: '154.29.00', descricao: 'Curva Contínua Calandrada (trilho até 6 m)', valor: 423.5 },
  { codigo: '154.30.00', descricao: 'Curva Contínua Calandrada (trilho acima de 6 m)', valor: 726 },
];

export function curvaByCodigo(codigo?: string | null): CurvaTrilho | undefined {
  return codigo ? CURVAS_TRILHO.find((c) => c.codigo === codigo) : undefined;
}
