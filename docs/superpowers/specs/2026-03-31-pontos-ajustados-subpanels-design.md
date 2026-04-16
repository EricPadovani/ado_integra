# Design: Sub-painéis por Categoria no Painel Pontos Ajustados

**Data:** 2026-03-31
**Status:** Aprovado

## Problema

O painel "Pontos Ajustados" atual:
1. Não tem scroll isolado — rola junto com o modal inteiro, afetando a leitura da análise IA à esquerda
2. Exibe dados brutos do work item sem estrutura editorial ou contexto semântico
3. Não diferencia visualmente as três fontes (FF, FS, FM)

## Solução

Refatorar a coluna direita do modal para:
1. Ter `overflow-y: auto` com altura máxima travada ao modal — scroll isolado
2. Dividir em 3 sub-painéis opcionais (um por campo), cada um com cabeçalho colorido distinto
3. Exibir card compacto e comentário editorial fixo por tipo de fonte

## Layout

```
┌─ PONTOS AJUSTADOS ──────────────────┐
│  overflow-y: auto                   │
│                                     │
│ ┌─ FONTE FUNCIONALIDADE (FF) ──────┐│  azul #1e4d8c
│ │ #567 — Título truncado 80 chars  ││
│ │ User Story · Active              ││
│ │ Responsável: João Silva          ││
│ │ Sprint: Sprint_X                 ││
│ │ ℹ Funcionalidade de origem       ││
│ │ [Ver no Azure ↗]                 ││
│ └──────────────────────────────────┘│
│                                     │
│ ┌─ FONTE SISTEMA (FS) ─────────────┐│  verde #2e7d32
│ │ ...                              ││
│ └──────────────────────────────────┘│
│                                     │
│ ┌─ FONTE MÓDULO (FM) ──────────────┐│  roxo #6a1b9a
│ │ ...                              ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

## Especificação dos Sub-painéis

### Cabeçalhos por tipo

| Campo | Rótulo | Cor do cabeçalho | Comentário editorial |
|-------|--------|-----------------|----------------------|
| O_FONTEFF | FONTE FUNCIONALIDADE (FF) | `#1e4d8c` (azul) | "Funcionalidade de origem deste ajuste" |
| O_FONTEFS | FONTE SISTEMA (FS) | `#2e7d32` (verde-escuro) | "Sistema fonte referenciado" |
| O_FONTEFM | FONTE MÓDULO (FM) | `#6a1b9a` (roxo) | "Módulo fonte referenciado" |

### Conteúdo do card

- **ID + Título:** `#567 — Título truncado a 80 chars...`
- **Linha tipo/estado:** `User Story · Active` (separados por ·)
- **Responsável:** nome do displayName ou `-`
- **Sprint:** último segmento do path (ex: `Sprint_X`)
- **Comentário editorial:** linha com ℹ e texto fixo por tipo
- **Link:** "Ver no Azure ↗"

### Comportamento

- Sub-painel só renderiza se o campo correspondente estiver preenchido e não for `'0'`
- Se nenhum campo preenchido: coluna direita oculta (comportamento atual mantido)
- Scroll isolado: `.analise-col-right` recebe `overflow-y: auto` e `max-height` calculado para não ultrapassar o modal

## CSS alterado

- `.analise-col-right`: adicionar `overflow-y: auto`, `max-height: calc(80vh - 80px)`
- Novas classes: `.ref-subpanel`, `.ref-subpanel-header`, `.ref-subpanel-body`, `.ref-card-meta`, `.ref-card-comment`
- Remover: `.ref-card`, `.ref-card-label`, `.ref-card-title`, `.ref-card-link`, `.ref-card-loading`, `.ref-card-error` (substituídas)

## Arquivos alterados

- `busca_ado.js`: função `gerarHTML()` — CSS e função `renderPontosAjustados`
- Sem alterações em `api-server.js`
