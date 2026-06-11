import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  acionamentosFor,
  modelosFor,
  tiposFor,
  colecoesFor,
  coresTecidoFor,
  coresAcabamentoFor,
} from '../../data/shadeQueries';
import { calculateShadePrice, getLimits, type ShadeDraft, type ShadeQuote } from '../../utils/calculatorShade';
import { motorsForModelo } from '../../utils/motorPrices';
import { cn } from '../../utils/cn';
import { COR_ACAB_NOMES, type OpcionalEscolhido, type ShadeItem } from '../../types/order';
import type { Brand } from '../../data/brands';
import { estoqueColecaoMap, estoqueCorMap, fabricMaxWidth } from '../../data/catalogStore';
import {
  calcOpcionalPrice,
  opcionaisFor,
  requiresAltura4xLargura,
  getSxpAlturasComando,
} from '../../data/sxpOpcionais';
import { StepShell } from './steps/StepShell';
import { SelectField } from './steps/SelectField';
import { ChipsField } from './steps/ChipsField';
import { ComboBox } from './steps/ComboBox';
import { OpcionaisField } from './steps/OpcionaisField';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtNum = (n: number, digits = 2) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// Ordem preferida para exibição dos tipos de tecido.
const TIPO_ORDER = ['Tela Solar', 'Outros', 'Blackout', 'Translucido'];
const sortTipos = (opts: readonly string[]) =>
  [...opts].sort((a, b) => {
    const ia = TIPO_ORDER.indexOf(a);
    const ib = TIPO_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

interface Props {
  brand: Brand;
  /** Família já escolhida no wrapper (Categoria). Trava o primeiro step. */
  familia: string;
  initialItem?: ShadeItem | null;
  onSave: (item: ShadeItem) => void;
}

// Estado em rascunho — strings vazias até preencher.
// Família já vem do parent (Categoria) — não faz parte do draft local.
type Draft = {
  acionamento: string;
  modelo: string;
  ambiente: string;
  widthStr: string;
  heightStr: string;
  quantity: number;
  tipoTecido: string;
  colecao: string;
  corTecido: string;
  corAcabamento: string;
  motor: string;
  // Lado do comando (manual) ou do motor (motorizada). Sem default.
  lado: 'Direita' | 'Esquerda' | '';
  comandoAlturaStr: string;
  // Módulos (produtos "DUPLA"). null = ainda não respondido (sem pré-seleção).
  modulosAssimetricos: boolean | null;
  modLargEsqStr: string;
  modLargDirStr: string;
  // Instalação — null = ainda não respondido (sem pré-seleção)
  mesmoAmbiente: boolean | null;
  ladoALado: boolean | null;
  ladoALadoCom: string;
  // Observação livre da revenda (campo OBS de cada item).
  observacao: string;
  // Opcionais selecionados (set de códigos).
  opcionais: Set<string>;
};

const emptyDraft = (): Draft => ({
  acionamento: '',
  modelo: '',
  ambiente: '',
  widthStr: '',
  heightStr: '',
  quantity: 1,
  tipoTecido: '',
  colecao: '',
  corTecido: '',
  corAcabamento: '',
  motor: '',
  lado: '',
  comandoAlturaStr: '',
  modulosAssimetricos: null,
  modLargEsqStr: '',
  modLargDirStr: '',
  mesmoAmbiente: null,
  ladoALado: null,
  ladoALadoCom: '',
  observacao: '',
  opcionais: new Set<string>(),
});

export function ShadeOrderFlow({ brand, familia, initialItem, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    initialItem
      ? {
          acionamento: initialItem.acionamento,
          modelo: initialItem.modelo,
          ambiente: initialItem.ambiente,
          widthStr: String(initialItem.widthMm),
          heightStr: String(initialItem.heightMm),
          quantity: initialItem.quantity,
          tipoTecido: initialItem.tipoTecido,
          colecao: initialItem.colecao,
          corTecido: initialItem.corTecido,
          corAcabamento: initialItem.corAcabamento,
          motor: initialItem.motor,
          lado: (() => {
            const l = initialItem.comandoLado ?? initialItem.motorLado ?? '';
            return l === 'Direita' || l === 'Esquerda' ? l : '';
          })(),
          comandoAlturaStr: initialItem.comandoAlturaMm ? String(initialItem.comandoAlturaMm) : '',
          modulosAssimetricos: initialItem.modulosAssimetricos ?? null,
          modLargEsqStr: initialItem.moduloLargEsqMm ? String(initialItem.moduloLargEsqMm) : '',
          modLargDirStr: initialItem.moduloLargDirMm ? String(initialItem.moduloLargDirMm) : '',
          mesmoAmbiente: initialItem.mesmoAmbiente ?? null,
          ladoALado: initialItem.ladoALado ?? null,
          ladoALadoCom: initialItem.ladoALadoCom ?? '',
          observacao: initialItem.observacao ?? '',
          opcionais: new Set(initialItem.opcionais?.map((o) => o.codigo) ?? []),
        }
      : emptyDraft(),
  );

  // Listas em cascata (recalculadas a cada mudança).
  const acionamentoOpts = useMemo(() => acionamentosFor(familia), [familia]);
  const modeloOpts = useMemo(
    () => modelosFor(familia, draft.acionamento),
    [familia, draft.acionamento],
  );
  const tipoOpts = useMemo(
    () => tiposFor(familia, draft.acionamento, draft.modelo),
    [familia, draft.acionamento, draft.modelo],
  );
  const colecaoOpts = useMemo(
    () => colecoesFor(draft.modelo, draft.tipoTecido),
    [draft.modelo, draft.tipoTecido],
  );
  const corTecidoOpts = useMemo(
    () => coresTecidoFor(draft.modelo, draft.colecao),
    [draft.modelo, draft.colecao],
  );
  const corAcabOpts = useMemo(
    () => coresAcabamentoFor(draft.modelo, draft.colecao, draft.corTecido),
    [draft.modelo, draft.colecao, draft.corTecido],
  );

  // Auto-seleção / reset quando dependências mudam.
  useEffect(() => {
    if (acionamentoOpts.length === 1 && draft.acionamento !== acionamentoOpts[0]) {
      setDraft((d) => ({ ...d, acionamento: acionamentoOpts[0] }));
    } else if (draft.acionamento && !acionamentoOpts.includes(draft.acionamento)) {
      setDraft((d) => ({ ...d, acionamento: '' }));
    }
  }, [acionamentoOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modeloOpts.length === 1 && draft.modelo !== modeloOpts[0]) {
      setDraft((d) => ({ ...d, modelo: modeloOpts[0] }));
    } else if (draft.modelo && !modeloOpts.includes(draft.modelo)) {
      setDraft((d) => ({ ...d, modelo: '' }));
    }
  }, [modeloOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tipoOpts.length === 1 && draft.tipoTecido !== tipoOpts[0]) {
      setDraft((d) => ({ ...d, tipoTecido: tipoOpts[0] }));
    } else if (draft.tipoTecido && !tipoOpts.includes(draft.tipoTecido)) {
      setDraft((d) => ({ ...d, tipoTecido: '', colecao: '', corTecido: '', corAcabamento: '' }));
    }
  }, [tipoOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.colecao && !colecaoOpts.includes(draft.colecao)) {
      setDraft((d) => ({ ...d, colecao: '', corTecido: '', corAcabamento: '' }));
    }
  }, [colecaoOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.corTecido && !corTecidoOpts.includes(draft.corTecido)) {
      setDraft((d) => ({ ...d, corTecido: '', corAcabamento: '' }));
    }
  }, [corTecidoOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.corAcabamento && !corAcabOpts.includes(draft.corAcabamento)) {
      setDraft((d) => ({ ...d, corAcabamento: '' }));
    }
  }, [corAcabOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cálculo do preço.
  const widthMm = Number(draft.widthStr) || 0;
  const heightMm = Number(draft.heightStr) || 0;
  const comandoAlturaMm = Number(draft.comandoAlturaStr) || 0;
  const isMotorized = !!(draft.acionamento && draft.acionamento !== 'MANUAL');
  const isManual = draft.acionamento === 'MANUAL';
  const isSxp = brand === 'shadexp';

  // Limites do modelo selecionado (para hint nos inputs).
  const limits = getLimits(familia, draft.acionamento, draft.modelo);

  // Estoque (Sob Consulta) da coleção / cor selecionadas.
  const estCol = useMemo(() => estoqueColecaoMap(), []);
  const estCor = useMemo(() => estoqueCorMap(), []);
  const colecaoSobConsulta = !!draft.colecao && estCol[draft.colecao] === 'sob_consulta';
  const corSobConsulta = !!draft.corTecido && estCor[draft.corTecido] === 'sob_consulta';

  // Largura máxima específica do tecido selecionado (pode ser menor que a do modelo).
  const tecidoLargMax = useMemo(
    () => (draft.corTecido ? fabricMaxWidth(draft.modelo, draft.colecao, draft.corTecido) : null),
    [draft.modelo, draft.colecao, draft.corTecido],
  );
  const larguraExcedeTecido = !!(tecidoLargMax && widthMm > tecidoLargMax);

  // Validações de dimensão (independentes do quote completo).
  const widthInvalid =
    !!(limits && widthMm > 0 && (widthMm < limits.largMin || widthMm > limits.largMax));
  const heightInvalid =
    !!(limits && heightMm > 0 && (heightMm < limits.altMin || heightMm > limits.altMax));
  const m2Atual = widthMm > 0 && heightMm > 0 ? (widthMm * heightMm) / 1_000_000 : 0;
  const areaExcedida =
    !!(limits && widthMm > 0 && heightMm > 0 && !widthInvalid && !heightInvalid && m2Atual > limits.m2Max);
  // Regra "Altura ≤ 4 × Largura" (ROLO, TRIPLE, DOUBLE VISION ShadeXP).
  const aplicaRegra4x = isSxp && requiresAltura4xLargura(familia);
  const proporcaoInvalida =
    !!(aplicaRegra4x && widthMm > 0 && heightMm > 0 && heightMm > 4 * widthMm);
  // Dimensões prontas: limites carregados, valores preenchidos e nenhuma regra violada.
  const dimsReady =
    !!(limits && widthMm > 0 && heightMm > 0 && !widthInvalid && !heightInvalid && !areaExcedida && !proporcaoInvalida);

  // Produtos com lado fixo "Dir./Esq." (DUPLA / DAY NIGHT) — não dá opção de escolher.
  const isDupla = /\bDUPLA\b/i.test(draft.modelo);
  const isDayNight = /DAY ?NIGHT/i.test(draft.modelo);
  const ladoFixo = isDupla || isDayNight;
  const ladoLabel = isManual ? 'Lado do Comando' : 'Lado do Motor';
  const ladoValue = ladoFixo ? 'Dir./Esq.' : draft.lado;
  const ladoReady = ladoFixo || !!draft.lado;

  // Altura do comando — só MANUAL.
  const alturaComandoReady = !isManual || comandoAlturaMm > 0;

  // Módulos assimétricos — só produtos DUPLA.
  const modEsqMm = Number(draft.modLargEsqStr) || 0;
  const modDirMm = Number(draft.modLargDirStr) || 0;
  const modulosReady =
    !isDupla ||
    (draft.modulosAssimetricos !== null &&
      (!draft.modulosAssimetricos || (modEsqMm > 0 && modDirMm > 0)));

  // Tudo dos "laterais" (lado + altura comando + módulos) pronto.
  const lateraisReady = dimsReady && ladoReady && alturaComandoReady && modulosReady;

  // Opcionais aplicáveis (ShadeXP). Só calcula depois que modelo está escolhido.
  const opcionaisAplicaveis = useMemo(
    () => (isSxp && draft.modelo ? opcionaisFor(draft.modelo) : []),
    [isSxp, draft.modelo],
  );
  // Resolve quais foram efetivamente escolhidos com valor calculado.
  const opcionaisEscolhidos: OpcionalEscolhido[] = useMemo(() => {
    if (!isSxp || !opcionaisAplicaveis.length) return [];
    return opcionaisAplicaveis
      .filter((r) => draft.opcionais.has(r.codigo))
      .map((r) => ({
        codigo: r.codigo,
        descricao: r.descricao,
        formula: r.formula,
        valorUnit: r.valor,
        valor: calcOpcionalPrice(r, { widthMm, heightMm, comandoAlturaMm }),
      }));
  }, [isSxp, opcionaisAplicaveis, draft.opcionais, widthMm, heightMm, comandoAlturaMm]);
  const opcionaisTotal = opcionaisEscolhidos.reduce((acc, o) => acc + o.valor, 0);

  // Limpa opcionais que deixaram de existir (modelo/acionamento mudou).
  useEffect(() => {
    const validCodes = new Set(opcionaisAplicaveis.map((r) => r.codigo));
    let changed = false;
    const next = new Set<string>();
    for (const c of draft.opcionais) {
      if (validCodes.has(c)) next.add(c);
      else changed = true;
    }
    if (changed) setDraft((d) => ({ ...d, opcionais: next }));
  }, [opcionaisAplicaveis]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftShade: ShadeDraft = {
    familia,
    acionamento: draft.acionamento || undefined,
    modelo: draft.modelo || undefined,
    tipoTecido: draft.tipoTecido || undefined,
    colecao: draft.colecao || undefined,
    corTecido: draft.corTecido || undefined,
    corAcabamento: draft.corAcabamento || undefined,
    motor: isMotorized ? draft.motor || undefined : undefined,
    widthMm: widthMm || undefined,
    heightMm: heightMm || undefined,
    quantity: draft.quantity,
    opcionaisTotal,
  };
  const quote: ShadeQuote = calculateShadePrice(draftShade);

  // Validação para habilitar o botão.
  const canAdd = quote.ok && (!isMotorized || !!draft.motor) && lateraisReady;

  const toggleOpcional = (codigo: string) => {
    setDraft((d) => {
      const next = new Set(d.opcionais);
      const rule = opcionaisAplicaveis.find((r) => r.codigo === codigo);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        // Remove qualquer exclusivo já marcado antes de marcar este.
        if (rule?.exclusiveWith) {
          for (const c of rule.exclusiveWith) next.delete(c);
        }
        next.add(codigo);
      }
      return { ...d, opcionais: next };
    });
  };

  const handleAdd = () => {
    if (!canAdd || !quote.ok) return;
    const final: ShadeItem = {
      kind: 'shade',
      id: initialItem?.id ?? Math.random().toString(36).slice(2, 11),
      brand,
      productCategory: 'Cortina',
      familia,
      acionamento: draft.acionamento,
      modelo: draft.modelo,
      ambiente: draft.ambiente,
      tipoTecido: draft.tipoTecido,
      colecao: draft.colecao,
      corTecido: draft.corTecido,
      corAcabamento: draft.corAcabamento,
      corAcabamentoNome: COR_ACAB_NOMES[draft.corAcabamento] || draft.corAcabamento,
      motor: isMotorized ? draft.motor : 'SEM MOTOR (INFORMATIVO)',
      widthMm,
      heightMm,
      quantity: draft.quantity,
      comandoLado: isManual ? (ladoValue || undefined) : undefined,
      comandoAlturaMm: isManual ? comandoAlturaMm : undefined,
      motorLado: isMotorized ? (ladoValue || undefined) : undefined,
      modulosAssimetricos: isDupla ? draft.modulosAssimetricos ?? undefined : undefined,
      moduloLargEsqMm: isDupla && draft.modulosAssimetricos ? modEsqMm : undefined,
      moduloLargDirMm: isDupla && draft.modulosAssimetricos ? modDirMm : undefined,
      mesmoAmbiente: draft.mesmoAmbiente || undefined,
      ladoALado: draft.ladoALado || undefined,
      ladoALadoCom: draft.ladoALado && draft.ladoALadoCom ? draft.ladoALadoCom : undefined,
      observacao: draft.observacao.trim() || undefined,
      opcionais: opcionaisEscolhidos.length ? opcionaisEscolhidos : undefined,
      opcionaisTotal: opcionaisEscolhidos.length ? opcionaisTotal : undefined,
      codigo: quote.codigo,
      m2: quote.m2,
      m2Cobrado: quote.m2Cobrado,
      vlrM2: quote.vlrM2,
      price: quote.price,
    };
    onSave(final);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-7"
    >
      {/* 2. Acionamento (Família é o step anterior, no wrapper) */}
      {familia && (
        <StepShell label="Acionamento">
          <ChipsField
            value={draft.acionamento}
            options={acionamentoOpts}
            cols={acionamentoOpts.length === 1 ? 2 : 3}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                acionamento: v,
                modelo: '',
                tipoTecido: '',
                colecao: '',
                corTecido: '',
                corAcabamento: '',
              }))
            }
            renderLabel={(o) =>
              o === 'MOTOR BATERIA' ? 'Motor Bateria' : o.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
            }
          />
        </StepShell>
      )}

      {/* 3. Modelo (Descricao Grupo) — ComboBox para não cortar descrições longas */}
      {draft.acionamento && (
        <StepShell label="Modelo / Descrição">
          <ComboBox
            value={draft.modelo}
            options={modeloOpts}
            placeholder="Escolha o modelo"
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                modelo: v,
                tipoTecido: '',
                colecao: '',
                corTecido: '',
                corAcabamento: '',
              }))
            }
          />
        </StepShell>
      )}

      {/* 4. Ambiente + Dimensões + Quantidade */}
      {draft.modelo && limits && (
        <>
          <StepShell label="Ambiente">
            <input
              type="text"
              placeholder="Ex: Sala de Estar"
              value={draft.ambiente}
              onChange={(e) => setDraft((d) => ({ ...d, ambiente: e.target.value }))}
              className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </StepShell>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <StepShell
                label="Largura (mm)"
                hint={
                  widthInvalid
                    ? undefined
                    : `Entre ${fmtNum(limits.largMin, 0)} e ${fmtNum(limits.largMax, 0)} mm`
                }
              >
                <input
                  type="number"
                  placeholder="0"
                  value={draft.widthStr}
                  onChange={(e) => setDraft((d) => ({ ...d, widthStr: e.target.value.replace(/^0+(?=\d)/, '') }))}
                  className={cn(
                    'w-full bg-white border p-4 rounded-2xl focus:outline-none focus:ring-2',
                    widthInvalid
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-zinc-200 focus:ring-zinc-900/5',
                  )}
                />
              </StepShell>
              {widthInvalid && (
                <p className="text-[11px] text-red-500 leading-tight">
                  {widthMm < limits.largMin
                    ? `Mínimo ${fmtNum(limits.largMin, 0)} mm`
                    : `Máximo ${fmtNum(limits.largMax, 0)} mm`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <StepShell
                label="Altura (mm)"
                hint={
                  heightInvalid
                    ? undefined
                    : `Entre ${fmtNum(limits.altMin, 0)} e ${fmtNum(limits.altMax, 0)} mm`
                }
              >
                <input
                  type="number"
                  placeholder="0"
                  value={draft.heightStr}
                  onChange={(e) => setDraft((d) => ({ ...d, heightStr: e.target.value.replace(/^0+(?=\d)/, '') }))}
                  className={cn(
                    'w-full bg-white border p-4 rounded-2xl focus:outline-none focus:ring-2',
                    heightInvalid
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-zinc-200 focus:ring-zinc-900/5',
                  )}
                />
              </StepShell>
              {heightInvalid && (
                <p className="text-[11px] text-red-500 leading-tight">
                  {heightMm < limits.altMin
                    ? `Mínimo ${fmtNum(limits.altMin, 0)} mm`
                    : `Máximo ${fmtNum(limits.altMax, 0)} mm`}
                </p>
              )}
            </div>
          </div>

          {areaExcedida && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 -mt-3">
              <p className="text-xs text-red-600 leading-snug">
                Área de <span className="font-semibold">{fmtNum(m2Atual, 2)} m²</span> excede o
                máximo de <span className="font-semibold">{fmtNum(limits.m2Max, 2)} m²</span> para
                este modelo. Reduza largura ou altura para continuar.
              </p>
            </div>
          )}

          {proporcaoInvalida && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 -mt-3">
              <p className="text-xs text-red-600 leading-snug">
                A altura não deve ultrapassar <span className="font-semibold">4 × a largura</span>.
                Para {fmtNum(widthMm, 0)} mm de largura, a altura máxima é{' '}
                <span className="font-semibold">{fmtNum(widthMm * 4, 0)} mm</span>.
              </p>
            </div>
          )}

          {/* Lado (Comando se MANUAL, Motor se motorizada) — sempre, com dimensões OK */}
          {dimsReady && (
            <StepShell
              label={ladoLabel}
              hint={ladoFixo ? 'Produto duplo / Day Night sai com os dois lados (Dir./Esq.).' : undefined}
            >
              {ladoFixo ? (
                <div className="w-full bg-zinc-900 text-white border border-zinc-900 rounded-2xl py-4 text-center font-medium">
                  Dir./Esq.
                </div>
              ) : (
                <ChipsField
                  value={draft.lado}
                  options={['Direita', 'Esquerda']}
                  cols={2}
                  onChange={(v) => setDraft((d) => ({ ...d, lado: v as 'Direita' | 'Esquerda' }))}
                />
              )}
            </StepShell>
          )}

          {/* Altura do Comando — só MANUAL */}
          {isManual && dimsReady && (
            <StepShell
              label="Altura do Comando (mm)"
              hint={
                isSxp
                  ? 'Alturas padrão: 500, 1.000, 1.200, 1.500, 1.800, 2.000, 2.500 ou 3.000 mm.'
                  : 'Em milímetros.'
              }
            >
              {isSxp ? (
                <div className="grid grid-cols-4 gap-2">
                  {getSxpAlturasComando().map((mm) => {
                    const active = comandoAlturaMm === mm;
                    return (
                      <button
                        key={mm}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, comandoAlturaStr: String(mm) }))}
                        className={cn(
                          'py-3 rounded-xl border text-xs font-medium transition-all',
                          active
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300',
                        )}
                      >
                        {mm.toLocaleString('pt-BR')}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="number"
                  placeholder="Ex: 1500"
                  value={draft.comandoAlturaStr}
                  onChange={(e) => setDraft((d) => ({ ...d, comandoAlturaStr: e.target.value }))}
                  className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                />
              )}
            </StepShell>
          )}

          {/* Módulos — só produtos DUPLA */}
          {isDupla && dimsReady && (
            <StepShell label="Módulos">
              <ChipsField
                value={
                  draft.modulosAssimetricos === null
                    ? ''
                    : draft.modulosAssimetricos
                    ? 'Assimétricos'
                    : 'Simétricos'
                }
                options={['Simétricos', 'Assimétricos']}
                cols={2}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, modulosAssimetricos: v === 'Assimétricos' }))
                }
              />
              {draft.modulosAssimetricos && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">
                      Módulo Esquerdo (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={draft.modLargEsqStr}
                      onChange={(e) => setDraft((d) => ({ ...d, modLargEsqStr: e.target.value }))}
                      className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">
                      Módulo Direito (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={draft.modLargDirStr}
                      onChange={(e) => setDraft((d) => ({ ...d, modLargDirStr: e.target.value }))}
                      className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                    />
                  </div>
                  {modEsqMm > 0 && modDirMm > 0 && modEsqMm + modDirMm !== widthMm && (
                    <p className="col-span-2 text-[11px] text-amber-600 leading-tight">
                      Soma dos módulos ({fmtNum(modEsqMm + modDirMm, 0)} mm) difere da largura total
                      ({fmtNum(widthMm, 0)} mm). Confirme se está correto.
                    </p>
                  )}
                </div>
              )}
            </StepShell>
          )}

          <StepShell label="Quantidade">
            <div className="flex items-center justify-between bg-white border border-zinc-200 p-2 rounded-2xl">
              <button
                onClick={() =>
                  setDraft((d) => ({ ...d, quantity: Math.max(1, d.quantity - 1) }))
                }
                className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
              >
                -
              </button>
              <span className="text-lg font-medium">{draft.quantity}</span>
              <button
                onClick={() => setDraft((d) => ({ ...d, quantity: d.quantity + 1 }))}
                className="w-12 h-12 flex items-center justify-center hover:bg-zinc-50 rounded-xl transition-colors"
              >
                +
              </button>
            </div>
          </StepShell>
        </>
      )}

      {/* Instalação: Mesmo Ambiente e Lado a Lado */}
      {draft.modelo && limits && lateraisReady && (
        <>
          <StepShell label="Mesmo Ambiente?">
            <ChipsField
              value={draft.mesmoAmbiente === null ? '' : draft.mesmoAmbiente ? 'Sim' : 'Não'}
              options={['Não', 'Sim']}
              cols={2}
              onChange={(v) => setDraft((d) => ({ ...d, mesmoAmbiente: v === 'Sim' }))}
            />
          </StepShell>

          <StepShell
            label="Lado a Lado com outro item?"
            hint={draft.ladoALado ? 'Informe qual item fica ao lado (ex: "Item 1" ou "Sala de Estar").' : undefined}
          >
            <ChipsField
              value={draft.ladoALado === null ? '' : draft.ladoALado ? 'Sim' : 'Não'}
              options={['Não', 'Sim']}
              cols={2}
              onChange={(v) => setDraft((d) => ({ ...d, ladoALado: v === 'Sim', ladoALadoCom: v === 'Não' ? '' : d.ladoALadoCom }))}
            />
            {draft.ladoALado && (
              <input
                type="text"
                placeholder="Ex: Item 1 — Sala de Estar"
                value={draft.ladoALadoCom}
                onChange={(e) => setDraft((d) => ({ ...d, ladoALadoCom: e.target.value }))}
                className="mt-3 w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
              />
            )}
          </StepShell>
        </>
      )}

      {/* 5. Tipo de Tecido — só aparece quando dimensões, lado, comando e módulos estão prontos */}
      {draft.modelo && limits && lateraisReady && (
        <StepShell label="Tipo de Tecido">
          <ChipsField
            value={draft.tipoTecido}
            options={sortTipos(tipoOpts)}
            cols={tipoOpts.length <= 2 ? 2 : tipoOpts.length === 3 ? 3 : 4}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                tipoTecido: v,
                colecao: '',
                corTecido: '',
                corAcabamento: '',
              }))
            }
            renderLabel={(t) => (isSxp && t === 'Outros' ? 'TELA SOLAR' : t.toUpperCase())}
          />
        </StepShell>
      )}

      {/* 6. Coleção */}
      {draft.tipoTecido && (
        <StepShell label="Coleção">
          <ComboBox
            value={draft.colecao}
            options={colecaoOpts}
            placeholder="Escolha a coleção"
            onChange={(v) =>
              setDraft((d) => ({ ...d, colecao: v, corTecido: '', corAcabamento: '' }))
            }
          />
          {colecaoSobConsulta && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm">⚠️</span>
              <p className="text-[11px] leading-snug text-amber-700">
                <span className="font-semibold">Sob Consulta</span> — esta coleção está com estoque
                baixo. Confirme a disponibilidade antes de fechar o pedido.
              </p>
            </div>
          )}
        </StepShell>
      )}

      {/* 7. Cor do Tecido */}
      {draft.colecao && (
        <StepShell label="Cor do Tecido">
          <ComboBox
            value={draft.corTecido}
            options={corTecidoOpts}
            placeholder="Escolha a cor do tecido"
            onChange={(v) => setDraft((d) => ({ ...d, corTecido: v, corAcabamento: '' }))}
          />
          {corSobConsulta && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm">⚠️</span>
              <p className="text-[11px] leading-snug text-amber-700">
                <span className="font-semibold">Sob Consulta</span> — esta cor está com estoque
                baixo. Confirme a disponibilidade antes de fechar o pedido.
              </p>
            </div>
          )}
          {larguraExcedeTecido && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] leading-snug text-red-600">
                A largura de <span className="font-semibold">{fmtNum(widthMm, 0)} mm</span> excede o
                máximo deste tecido (<span className="font-semibold">{fmtNum(tecidoLargMax!, 0)} mm</span>).
                Reduza a largura ou escolha outro tecido.
              </p>
            </div>
          )}
        </StepShell>
      )}

      {/* 8. Cor do Acabamento */}
      {draft.corTecido && (
        <StepShell label="Cor do Acabamento">
          <ChipsField
            value={draft.corAcabamento}
            options={corAcabOpts}
            cols={Math.min(4, Math.max(2, corAcabOpts.length)) as 2 | 3 | 4}
            onChange={(v) => setDraft((d) => ({ ...d, corAcabamento: v }))}
            renderLabel={(c) => COR_ACAB_NOMES[c] || c}
          />
        </StepShell>
      )}

      {/* 9. Motor (somente se Motorizada / Motor Bateria) */}
      {draft.corAcabamento && isMotorized && (
        <StepShell label="Motor">
          <SelectField
            value={draft.motor}
            options={motorsForModelo(draft.modelo, familia)}
            placeholder="Escolha o motor"
            onChange={(v) => setDraft((d) => ({ ...d, motor: v }))}
          />
        </StepShell>
      )}

      {/* 10. Opcionais (ShadeXP) — só aparece depois de Acabamento e do Motor (quando motorizada) */}
      {isSxp && draft.corAcabamento && (!isMotorized || draft.motor) && opcionaisAplicaveis.length > 0 && (
        <StepShell
          label="Opcionais (acessórios)"
          hint="Marque os acessórios que deseja incluir. Cada opcional é cobrado por peça."
        >
          <OpcionaisField
            rules={opcionaisAplicaveis}
            selected={draft.opcionais}
            widthMm={widthMm}
            heightMm={heightMm}
            comandoAlturaMm={comandoAlturaMm}
            onToggle={toggleOpcional}
          />
        </StepShell>
      )}

      {/* 11. Observação (OBS) — campo livre, no final do item */}
      {draft.modelo && limits && lateraisReady && (
        <StepShell label="Observação" hint="(Opcional) Notas sobre este item para a produção.">
          <textarea
            rows={2}
            placeholder="Ex: detalhe de instalação, referência do ambiente, etc."
            value={draft.observacao}
            onChange={(e) => setDraft((d) => ({ ...d, observacao: e.target.value }))}
            className="w-full bg-white border border-zinc-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 resize-none"
          />
        </StepShell>
      )}

      {/* Resumo (quando há código encontrado) */}
      {quote.ok && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 text-sm"
          >
            <div className="flex justify-between text-zinc-500">
              <span>Código</span>
              <span className="font-mono text-zinc-800">{quote.codigo}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Área</span>
              <span>
                {fmtNum(quote.m2, 2)} m²{' '}
                {quote.m2 < quote.m2Cobrado && (
                  <span className="text-zinc-400">(cobrado {fmtNum(quote.m2Cobrado, 2)})</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Valor m²</span>
              <span>R$ {fmtBRL(quote.vlrM2)}</span>
            </div>
            {quote.motorPrice > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>Motor</span>
                <span>R$ {fmtBRL(quote.motorPrice)}</span>
              </div>
            )}
            {opcionaisEscolhidos.length > 0 && (
              <>
                <div className="border-t border-zinc-100 mt-2 pt-2 text-[11px] uppercase tracking-widest text-zinc-400">
                  Opcionais
                </div>
                {opcionaisEscolhidos.map((o) => (
                  <div key={o.codigo} className="flex justify-between text-zinc-500">
                    <span className="truncate pr-2">{o.descricao}</span>
                    <span>R$ {fmtBRL(o.valor)}</span>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Footer fixo de preço */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-100 p-6 flex items-center justify-between z-40">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Valor Estimado</p>
          <p className="text-2xl font-semibold">
            R$ {fmtBRL(quote.ok ? quote.price : 0)}
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={cn(
            'bg-zinc-900 text-white px-8 py-4 rounded-2xl font-medium shadow-lg shadow-zinc-200',
            !canAdd && 'opacity-50 cursor-not-allowed',
          )}
        >
          {initialItem ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </motion.div>
  );
}
