# Design: Painel de Pontos Ajustados no Modal de Análise IA

**Data:** 2026-03-31
**Status:** Aprovado

## Problema

Quando a RFC `Z_IN_PGM` retorna valores nos campos `O_FONTEFF`, `O_FONTEFS` ou `O_FONTEFM`, esses valores são números de Work Items do Azure DevOps que representam pontos ajustados relacionados ao programa SAP. Atualmente esses dados são ignorados no front-end.

## Solução

Transformar o modal de Análise IA em layout de 2 colunas quando houver referências de ADO nos campos da RFC:

- **Coluna esquerda (existente):** análise atual (dados ADO do work item principal + análise IA)
- **Coluna direita (nova):** cards dos work items referenciados em `O_FONTEFF`, `O_FONTEFS`, `O_FONTEFM`

Se todos os três campos estiverem vazios ou zero, o modal permanece em coluna única (comportamento atual).

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ 🤖 Análise IA — Work Item #1234                            [×] │
├──────────────────────────────────┬─────────────────────────────┤
│ ANÁLISE                          │ PONTOS AJUSTADOS            │
│                                  │                             │
│ 🔵 ADO #1234 (detalhes)          │ O_FONTEFF → #567            │
│ 🤖 IA — ZSAFE... (análise)       │  [ card: título/tipo/       │
│                                  │    estado/responsável/link ]│
│                                  │                             │
│                                  │ O_FONTEFS → #890            │
│                                  │  [ card ]                   │
│                                  │                             │
│                                  │ O_FONTEFM → #321            │
│                                  │  [ card ]                   │
└──────────────────────────────────┴─────────────────────────────┘
```

## Fluxo de Dados

1. RFC retorna `result` — `sapData.O_FONTEFF`, `sapData.O_FONTEFS`, `sapData.O_FONTEFM`
2. Front filtra campos não vazios e não zero
3. Para cada campo com valor, faz `fetch` à ADO API:
   `GET /wit/workitems/{id}?api-version=7.0`
4. Exibe card com: Título, Tipo, Estado, Responsável, Sprint, link "Ver no Azure"
5. Erros de fetch exibem mensagem inline no card (não bloqueiam o restante)

## Campos do Card

| Campo | Fonte ADO |
|-------|-----------|
| Título | `System.Title` |
| Tipo | `System.WorkItemType` |
| Estado | `System.State` |
| Responsável | `System.AssignedTo.displayName` |
| Sprint | `System.IterationPath` |
| Link | `_links.html.href` |

## Responsividade

Em telas ≤ 768px, as colunas empilham verticalmente (coluna direita abaixo da esquerda).

## Escopo

- Alterações apenas em `busca_ado.js` (template HTML gerado)
- Sem alterações no `api-server.js`
- O token ADO já disponível no template via interpolação do `.env`
