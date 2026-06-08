# Luxashade / ShadeXP — Contexto do Projeto

> Documento de referência **vivo** do app de pedidos da Luxashade. Atualize quando algo estrutural mudar (fluxo, marca, catálogo, regras de preço, opcionais, webhook).
>
> Última atualização: **2026-05-14**

---

## 1. Visão geral

App mobile-first em React 19 + Vite + TS + Tailwind v4 + Framer Motion (`motion/react`).
B2B: revendas configuram itens e enviam pedido ou orçamento para um webhook n8n.

**Marcas atendidas no mesmo app** (escolha no início de cada pedido):

| Marca | Famílias disponíveis |
|---|---|
| **Luxashade** | TRILHO MOTORIZADO, ROLLER SHADE, DUAL SHADE, ROMAN SHADE, CELULAR SHADE, SOFT SHADE |
| **ShadeXP** | ROLÔ (ROLO), DOUBLE VISION, ROMANA, CELULAR, TRIPLE SHADE |

Trilho fica apenas na Luxashade. As 10 famílias de cortina já existem no mesmo catálogo (`shadeCatalog.ts`) — a separação por marca é apenas de **filtro** no dropdown "Categoria".

---

## 2. Fluxo do usuário (atualizado)

```
landing → brand → cnpj → order (loop) → cart → final → success
                                  ↑                ↑
                            BrandPicker      "Fazer Orçamento" ou "Finalizar Pedido"
```

1. **landing** — splash com a marca-mãe ("LUXASHADE × SHADEXP") e botão "Iniciar Pedido".
2. **brand** — 2 cards (Luxashade / ShadeXP). Card mostra tagline + 4 famílias-preview.
3. **cnpj** — CNPJ da revenda. Mostra a marca selecionada acima do título.
4. **order** — `OrderFlow.tsx` é o wrapper que monta `TrilhoOrderFlow` ou `ShadeOrderFlow` conforme a Categoria escolhida no dropdown (filtrado pela marca).
5. **cart** — lista de itens com edição/remoção e dois botões lado-a-lado: `Fazer Orçamento` (outline branco) e `Finalizar Pedido` (preto). Define `tipoEnvio: 'orcamento' | 'pedido'`.
6. **final** — coleta nome + telefone. Subtítulo e CTA mudam conforme `tipoEnvio`.
7. **success** — confirmação. Botão "Novo Orçamento" ou "Novo Pedido".

---

## 3. Fluxo interno do item (ShadeOrderFlow)

Cada passo só aparece quando o anterior está válido (progressive disclosure):

1. **Categoria** (no wrapper `OrderFlow`) — dropdown filtrado pela marca. ROLO aparece como "ROLÔ".
2. **Acionamento** — MANUAL / MOTORIZADA / MOTOR BATERIA (auto-seleciona se houver 1 só).
3. **Modelo / Descrição** — dependente de família+acionamento.
4. **Ambiente** (texto livre).
5. **Largura (mm) / Altura (mm)** — validações inline em vermelho, **imediatas** (não esperam preencher o resto):
   - Largura/Altura fora de [min, max] → "Mínimo X mm" / "Máximo X mm" abaixo do input.
   - Área > m²Max do modelo → painel vermelho "Área de X m² excede o máximo de Y m²".
   - **Regra Alt ≤ 4 × Largura** (só ShadeXP: ROLO, TRIPLE, DOUBLE VISION) → painel vermelho.
   - Os passos seguintes **só renderizam quando dimensões válidas**.
6. **Lado do Comando** (chips Direita / Esquerda) — **só quando `acionamento === MANUAL`**. Default Direita.
7. **Altura do Comando (mm)** — **só MANUAL**.
   - ShadeXP: grid de chips com as 8 alturas-padrão da fábrica: `500, 1000, 1200, 1500, 1800, 2000, 2500, 3000` mm.
   - Luxashade: input number livre (em mm).
8. **Quantidade**.
9. **Tipo de Tecido** (TS/BK/TR/Outros).
10. **Coleção** (combobox com filtro).
11. **Cor do Tecido** (combobox com filtro).
12. **Cor do Acabamento** (chips: Branco 01 / Bege 02 / Cinza 03 / Preto 05).
13. **Motor** — só motorizadas. Reusa a mesma lista do Trilho (`MOTORS` em `motorPrices.ts`).
14. **Opcionais (acessórios)** — **só ShadeXP**. Lista de regras `OpcionalRule` aplicáveis ao modelo. Exclusividades (TDF × Bandô) são respeitadas no toggle. Mostra preço total já calculado por peça.

Footer fixo com **Valor Estimado** e botão `Adicionar` / `Salvar` (disabled enquanto `canAdd` for false).

### Fluxo do TrilhoOrderFlow (mantido)

Modelo de Cortina → Ambiente → Largura/Altura → Quantidade → Abertura → Cor do Trilho → Lado do Motor → Motor. Sem alterações estruturais — só passou a persistir `brand` no item.

---

## 4. Cálculo do preço

### Shade (cortinas)
`calculatorShade.calculateShadePrice(draft) → ShadeQuote`

```
m² real          = (widthMm × heightMm) / 1.000.000
m² cobrado       = max(m², m²Min do modelo)
preço da peça    = m²Cobrado × VlrM² + motorPrice + opcionaisTotal
preço final      = preço da peça × quantity
```

- `VlrM²` vem de uma linha do catálogo (`ROWS`) localizada por `(famIdx, acionIdx, modeloIdx, tipoIdx, colIdx, corTecIdx, corAcabIdx)`.
- `motorPrice` = `MOTOR_PRICES[motor][corMotor]`, onde `corMotor` é Branco ou Preto derivada do código de acabamento (`05` → Preto, demais → Branco). Só soma se `acionamento ≠ MANUAL` e `motor` preenchido.
- `opcionaisTotal` = soma de `calcOpcionalPrice(rule, ctx)` para cada opcional selecionado. Fórmulas:

| Fórmula | Cobrança |
|---|---|
| `fixo` | `valor` |
| `porLargura` | `valor × (widthMm/1000)` |
| `porAltura` | `valor × (heightMm/1000)` |
| `porAltComando` | `valor × (comandoAlturaMm/1000)` |

### Trilho
`calculator.calculatePrice(item)` — mantém a lógica original (componentes do trilho + motor). Sem alterações.

---

## 5. Catálogo de dados

### `src/data/shadeCatalog.ts` (gerado por script — NÃO editar à mão)

8.015 produtos normalizados como tuplas numéricas + interning de strings + índices em cascata para o filtro:

- `FAMILIAS` (10), `ACIONAMENTOS` (3), `MODELOS` (~45), `TIPOS_TECIDO` (4), `COLECOES` (~67), `CORES_TECIDO` (~131), `CORES_ACAB` (4).
- `ROWS`: `readonly [famIdx, acionIdx, modeloIdx, tipoIdx, colIdx, corTecIdx, corAcabIdx, vlrM2, codigo][]`.
- Índices `ACION_BY_FAM`, `MODELO_BY_FAM_ACION`, `TIPO_BY_FAM_ACION_MODELO`, `COL_BY_MODELO_TIPO`, `COR_TEC_BY_MODELO_COL`, `COR_ACAB_BY_MODELO_COL_COR_TEC`.

### `src/data/shadeModelLimits.ts` (gerado)

`SHADE_MODEL_LIMITS: Record<"familia|acionamento|modelo", {largMin, largMax, altMin, altMax, m2Min, m2Max}>`.

### `src/data/shadeQueries.ts`

Helpers de cascata que retornam `string[]` para os dropdowns do form.

### `src/data/brands.ts` (NOVO)

- `Brand = 'luxashade' | 'shadexp'`.
- `BRAND_LABEL`, `BRAND_TAGLINE`.
- `FAMILIES_BY_BRAND` (filtro do dropdown).
- `FAMILY_DISPLAY['ROLO'] = 'ROLÔ'` (label).
- `TRILHO_OPT = 'TRILHO MOTORIZADO'`.

### `src/data/sxpOpcionais.ts` (NOVO)

Regras de acessórios **por modelo** (chave = string do modelo no catálogo). Extraídas da planilha ShadeXP (abas ROLO MANUAL, ROLO MOTORIZADA, ROMANA MANUAL/MOTORIZADA, TRIPLE SHADE MANUAL/MOTORIZADA, DOUBLE VISION MANUAL/MOTORIZADA, CELULAR MANUAL/MOTORIZADA).

Resumo:

| Modelo | Opcionais |
|---|---|
| `CORTINA ROLO SXP38 AC MANUAL` | TDF (grátis, ex-Bandô), Corrente Metálica Bola 10 (R$ 33 × AltCmd), Bandô C (R$ 160 × Larg, ex-TDF), Guia Lateral 55mm (R$ 162,80 × Alt) |
| `CORTINA ROLO SXP50 AC MANUAL` | TDF, Corrente Metálica, Bandô Quadrado (R$ 195 × Larg, ex-TDF), Guia Lateral 55mm |
| `CORTINA ROLO SXP55 AC MOTORIZADO` | TDF, Bandô Quadrado (R$ 195 × Alt, ex-TDF), Guia Lateral 55mm |
| `CORTINA ROLO SX65/SXP75/SXP95 AC MOTORIZADO` | TDF, Guia Lateral 80mm (R$ 198 × Alt) |
| `CORTINA TRIPLE SHADE SXP50 MANUAL/MOTORIZADA` | Square Box LXG (R$ 198 × Larg) |
| `CORTINA DOUBLE VISION SXP38/SXP50 MANUAL/MOTORIZADA` | Square Box LXG |
| ROMANA RO1/RO2, CELULAR CL1/CL2 | Sem acessórios específicos |

Para **qualquer SXP motorizada**, soma-se a lista `SXP_CONTROLES_MOTORIZADA`: Emissor Shadeexp 1 Canal (98), 15 Canais (158), Controle Somfy Situo 1/4/16 Canais (290/550/1680). Todos `fixo`.

Outros exports:
- `requiresAltura4xLargura(familia)` — true para ROLO, TRIPLE, DOUBLE VISION.
- `SXP_ALTURAS_COMANDO_MM` — `[500, 1000, 1200, 1500, 1800, 2000, 2500, 3000]`.
- `opcionaisFor(modelo, acionamento)` — concatena base do modelo + controles (se motorizada).
- `calcOpcionalPrice(rule, ctx)` — aplica a fórmula.

### `src/utils/motorPrices.ts`

Tabela `MOTOR_PRICES: { [motor]: { Branco, Preto } }` para 7 motores (Somfy Glydea/Elatio/LSN, Ivolve IV50/IV60, Sem Motor). Compartilhada entre Trilho e Shade.

---

## 6. Tipos (`src/types/order.ts`)

```ts
type OrderItem = TrilhoItem | ShadeItem;  // união discriminada por `kind`

TrilhoItem = {
  kind: 'trilho';
  id, brand, productCategory='Trilho',
  model, environment, quantity,
  width, height, opening, railColor, motorSide, motor,
  price
}

ShadeItem = {
  kind: 'shade';
  id, brand, productCategory='Cortina',
  familia, acionamento, modelo, ambiente,
  tipoTecido, colecao, corTecido,
  corAcabamento, corAcabamentoNome,
  motor,                         // 'SEM MOTOR (INFORMATIVO)' se MANUAL
  widthMm, heightMm, quantity,
  comandoLado?, comandoAlturaMm?,// só MANUAL
  opcionais?: OpcionalEscolhido[], opcionaisTotal?,
  codigo, m2, m2Cobrado, vlrM2,
  price
}
```

`COR_ACAB_NOMES`: `01→Branco, 02→Bege, 03→Cinza, 05→Preto` (+ variantes sem zero à esquerda).
`motorColorFromAcabamento(cod)` retorna `'Branco' | 'Preto'` para o pricing do motor.

---

## 7. Webhook

`POST https://147hook.criate.online/webhook/94e9c23d-4b00-40aa-8e20-8e4da2c94907`

```json
{
  "schemaVersion": 2,
  "tipo": "orcamento" | "pedido",
  "marca": "luxashade" | "shadexp",
  "cnpj": "...",
  "customer": { "name": "...", "phone": "..." },
  "items": [ TrilhoItem | ShadeItem, ... ],
  "total": 1234.56
}
```

---

## 8. Estrutura de arquivos

```
src/
├─ App.tsx                       # Router de steps + carrinho + final + success
├─ main.tsx
├─ components/
│  ├─ BrandPicker.tsx            # Tela "Selecione a marca" (Luxashade vs ShadeXP)
│  ├─ OrderFlow.tsx              # Wrapper: Categoria filtrada por brand → Trilho/Shade
│  ├─ trilho/
│  │  └─ TrilhoOrderFlow.tsx     # Form do trilho motorizado
│  └─ shade/
│     ├─ ShadeOrderFlow.tsx      # Form das 10 famílias de cortina
│     └─ steps/
│        ├─ StepShell.tsx        # Label + container animado
│        ├─ SelectField.tsx      # <select> estilizado (suporta renderLabel)
│        ├─ ChipsField.tsx       # Grid de botões (chips) selecionáveis
│        ├─ ComboBox.tsx         # Dropdown com filtro digitável
│        └─ OpcionaisField.tsx   # Lista de acessórios opcionais (ShadeXP)
├─ data/
│  ├─ brands.ts                  # Marca + filtro de famílias + display
│  ├─ shadeCatalog.ts            # 8.015 produtos normalizados (gerado)
│  ├─ shadeModelLimits.ts        # Limites por modelo (gerado)
│  ├─ shadeQueries.ts            # Helpers de cascata
│  └─ sxpOpcionais.ts            # Regras de acessórios ShadeXP + regra 4× + alturas comando
├─ types/
│  └─ order.ts                   # OrderItem (união discriminada), tipos auxiliares
└─ utils/
   ├─ calculator.ts              # Preço do trilho
   ├─ calculatorShade.ts         # Preço das cortinas (m² + motor + opcionais)
   ├─ motorPrices.ts             # Tabela compartilhada de motores
   └─ cn.ts                      # classnames merge

scripts/
└─ build-shade-catalog.ts        # Lê a planilha Google Sheets e regenera shadeCatalog/Limits
```

Scripts:
- `npm run dev` — Vite dev server em `:3000`.
- `npm run lint` → `tsc --noEmit`.
- `npm run build` — Vite production build.
- `npm run build:shade-catalog` — Regenera `shadeCatalog.ts` e `shadeModelLimits.ts` a partir da planilha Luxashade.

---

## 9. Decisões de produto registradas

- Marcas separadas, mas mesmo catálogo: ROLLER/DUAL/ROMAN/CELULAR-SHADE/SOFT → Luxashade; ROLO/DOUBLE VISION/ROMANA/CELULAR/TRIPLE-SHADE → ShadeXP. Trilho fica só na Luxashade.
- Categoria começa com TRILHO MOTORIZADO no menu Luxashade; ROLO aparece como "ROLÔ" no menu ShadeXP.
- Validação de dimensões aparece **na hora** (mensagem em vermelho abaixo do input ou painel de área excedida) e **bloqueia** os passos seguintes — não deixa o usuário preencher tudo e só descobrir o erro no fim.
- Lado/Altura do Comando só pra MANUAL. ShadeXP restringe altura aos 8 valores de corrente padrão; Luxashade aceita input livre.
- Opcionais só na ShadeXP, com exclusividades TDF × Bandô respeitadas no toggle.
- Cor de acabamento sempre `01/02/03/05` (Branco/Bege/Cinza/Preto). Cor do motor (Branco/Preto) é derivada automaticamente para o pricing.
- Carrinho diferencia trilho (`text-amber-600`) vs cortina (`text-emerald-600`) e mostra um bloco com os opcionais escolhidos quando houver.
- O botão final do carrinho são **dois**: "Fazer Orçamento" (outline) e "Finalizar Pedido" (sólido). Ambos vão para a mesma tela de nome/telefone; só muda o `tipo` enviado no webhook.

---

## 10. O que ficou de fora (backlog explícito)

- Catálogo de opcionais para **Luxashade** (a planilha Luxashade não detalha opcionais — só ShadeXP tem essa especificação completa). Quando vier, basta replicar `sxpOpcionais.ts` para `luxaOpcionais.ts` e ativar no `ShadeOrderFlow` mediante `brand`.
- Campo "Mesmo ambiente?" da planilha Form PEDIDO (sinaliza para a fábrica alinhar varetas/faixas em peças coladas). Atualmente não capturado.
- Filtros de motor por modelo no ShadeXP (planilha indica IV35/LSN35 para RL55/RL65, IV45/ALTUS45 para RL75/RL95). Atualmente a lista de motores é a do Trilho — pode ser refinada depois.
- "Tecido Desce pela Frente" como flag separada do TDF opcional (planilha Form PEDIDO tem coluna "Desce Front.?"). Hoje é só o opcional `TDF`.
- Prazos de produção (3 a 10 dias úteis) por família — informativo, ainda não exibido na UI.

---

## 11. Histórico recente de mudanças (mais novo → mais antigo)

1. **Marca + Opcionais ShadeXP** (esta rodada)
   - `BrandPicker` novo, step `brand` antes do CNPJ.
   - `OrderFlow` recebe `brand` e filtra famílias.
   - `ShadeOrderFlow`: Lado/Altura Comando (manual), regra Alt ≤ 4×Larg para ShadeXP, passo Opcionais com regras por modelo, opcionais somam no preço.
   - `App.tsx` adiciona `marca` no webhook e badge da marca em todas as telas; carrinho mostra opcionais.
   - Tipos `OrderItem` ganham `brand`; `ShadeItem` ganha `comandoLado`, `comandoAlturaMm`, `opcionais[]`.
   - Type-check + vite build passando.

2. **Validação imediata de dimensões**
   - Área excedida e min/max viraram alertas inline em vermelho abaixo dos inputs (não esperam mais o quote completo). Passos seguintes ficam bloqueados até as dimensões estarem corretas.

3. **Dois botões no carrinho**
   - "Fazer Orçamento" + "Finalizar Pedido" lado-a-lado. Telas seguintes adaptam textos. Webhook envia `tipo`.

4. **Wrapper único de Categoria**
   - Substituiu a tela intermediária "Trilho × Cortinas". Hoje a primeira pergunta do form é "Categoria" com Trilho + as famílias da marca.

5. **Refactor base (10 famílias de cortina)**
   - Script `build-shade-catalog.ts` gera os catálogos a partir da planilha Luxashade.
   - `ShadeOrderFlow` e `TrilhoOrderFlow` lado-a-lado, união discriminada `OrderItem`.

---

## 12. Como retomar o trabalho

- **Adicionar família nova**: rodar `npm run build:shade-catalog` (se vier da planilha Luxashade) ou inserir manualmente em `FAMILIES_BY_BRAND` + acrescentar entradas em `SXP_OPCIONAIS_BY_MODEL` se for SXP.
- **Mudar regra de preço**: editar `calculatorShade.ts` (mantém a forma `m²Cobrado × VlrM² + motor + opcionais` × quantidade).
- **Mudar regra de opcional**: editar `sxpOpcionais.ts` (mais o `SXP_CONTROLES_MOTORIZADA` para acessórios de motorizada).
- **Mudar tela de marca**: editar `BrandPicker.tsx`.
- **Antes de fechar a sessão**: rodar `npm run lint` e `npm run build` — ambos devem passar.

---

## 13. Painel de Controle (`/admin`) + Supabase

O catálogo deixou de ser **só estático**: agora vive no **Supabase** (projeto `luxashade-painel`, ref `jlfzjhkeebqchfqrdwer`, região `sa-east-1`) e é editável por um painel em `/admin`. Os arquivos `shadeCatalog.ts`, `shadeModelLimits.ts`, `PRODUTOS` (trilho), `motorPrices`, `sxpOpcionais` e `brands` continuam no repo como **fallback** offline.

### Fluxo de dados
```
Painel /admin  ──escreve──▶  Supabase (tabelas)  ──get_catalog()──▶  App (boot)  ──▶  Cris/revenda
                                  ▲                                      │
                              (RLS: escrita só autenticada)     fallback estático se offline
```

- **Boot**: `src/main.tsx` chama `hydrateCatalog()` (em `src/data/catalogStore.ts`) antes de renderizar. Busca `rpc('get_catalog')` (1 JSON, ~240 KB gzip, já filtrando fora-de-linha/indisponível e anexando estoque). Se falhar → usa o catálogo estático (`console`: `[catalog] fonte: remote|static`).
- **Módulos de lógica leem do store** (mesmas assinaturas de antes): `shadeQueries`, `calculatorShade`, `calculator` (trilho), `sxpOpcionais`, `motorPrices` (`getMotors/getSxpShadeMotors/motorPriceFor`), `brands` (`familiesForBrand/familyDisplay/brandTagline`).
- **`/admin`** (`src/admin/AdminApp.tsx`): detectado em `main.tsx` por `/admin`, `#admin` ou `?admin=1`. Login via Supabase Auth. Abas **Luxashade × ShadeXP** + módulos: Visão geral, **Preços (m²)** (filtro família/modelo + busca + ação em massa), **Dimensões**, **Coleções** (on/off + estoque "Sob Consulta"/"Em falta"), **Cores**, **Trilhos** (componentes editáveis), **Motores**, **Opcionais** (ShadeXP), **Configurações** (app_config em JSON), **Histórico** (audit_log).
- **Estoque no app**: coleção/cor `indisponivel` → some da seleção; `sob_consulta` → aparece com aviso âmbar "Sob Consulta" (em `ShadeOrderFlow`).

### Acesso ao painel
- Login inicial: **`admin@luxashade.app`** / **`LuxaShade#2026`** — **troque a senha** (Dashboard Supabase → Authentication, ou criar novo usuário). Signup não está exposto no app.

### Tabelas (schema `public`)
`marcas, acionamentos, familias, modelos, tipos_tecido, colecoes, cores_tecido, cores_acabamento, estoque_tecido, produtos (8015, preço m²), modelo_limites (45), motores, trilho_modelos/trilho_produtos/trilho_componentes, opcionais/opcional_modelos/opcional_exclusoes, app_config, audit_log`. RLS: **leitura pública, escrita só autenticada**. Triggers de `updated_at` e auditoria.

### Scripts
- `npx tsx scripts/seed-supabase.ts` — repovoa o Supabase a partir dos arquivos estáticos (idempotente após TRUNCATE). Usa `SUPABASE_ADMIN_PASSWORD`.
- `npm run build:shade-catalog` — ainda regenera os arquivos estáticos a partir da planilha (úteis como fallback / fonte para re-seed).

### Hardening pendente (opcional)
- As políticas de escrita são `authenticated` amplas (qualquer logado = admin). Como só existe 1 usuário e o signup não está no app, é seguro hoje; para múltiplos usuários, restringir por e-mail/allowlist.
- Ativar "Leaked Password Protection" no Auth.
