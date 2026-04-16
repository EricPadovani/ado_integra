# Design: Projeto Fechamento — Consolidação de Requests ABAP via ADO + SAP RFC

**Data:** 2026-04-16
**Status:** Aprovado

---

## Objetivo

Permitir que o usuário selecione um work item ADO, extraia automaticamente as requests ABAP listadas nos comentários, visualize o conteúdo de cada request via RFC SAP, remova requests indesejadas e consolide as restantes em uma única request por tipo — recebendo ao final o novo número da request consolidada.

---

## Estrutura de Arquivos

Projeto completamente independente — nenhum arquivo do projeto `ado` é referenciado ou modificado.

```
C:\vscode\fechamento\
├── fechamento.js       ← gerador Node.js (cópia adaptada do busca_ado.js)
├── fechamento.html     ← gerado pelo fechamento.js (não editar manualmente)
├── package.json        ← dependências próprias (axios, dotenv)
├── .env                ← ADO_TOKEN próprio
└── iniciar.bat         ← inicia o servidor e gera o HTML
```

O `api-server.js` (sap-mcp-server) recebe dois **novos endpoints** para as RFCs do fechamento. Os endpoints existentes não são alterados.

---

## Arquitetura

```
[fechamento.html]  ←gerado por→  [fechamento.js]
      │
      ├── GET /api/fechamento/request-content   ← RFC_GET_REQUEST_CONTENT
      └── POST /api/fechamento/consolidar       ← RFC_CONSOLIDATE_REQUESTS
             ↕
      [sap-mcp-server/api-server.js]
             ↕
           [SAP via RFC]
```

---

## Fluxo da Aplicação

```
[Tela inicial]
  └─ Lista de iterações ADO (igual ao iteracoes_ado)
       └─ Fonte: GET /api/iterations (ADO)

[Clique na iteração]
  └─ Modal com work items da sprint
       └─ Fonte: GET /api/workitems (ADO)

[Clique no work item]
  └─ Busca comentários do work item via ADO API
  └─ Parser extrai grupos de requests por tipo:
       WS     → [DVEXXXXXXXX, DVEXXXXXXXX]
       OBTI   → [DEVIIIIII]
       INSTAL → [DEVX9w1]
       UPDATE → [DEV97176781781]
  └─ Abre painel "Painel de Requests"

[Painel de Requests]
  └─ Exibe cards por tipo com lista de DEV numbers
  └─ Cada request tem botão ✕ para remoção
  └─ Botão "Ver Conteúdo" por grupo → chama RFC_GET_REQUEST_CONTENT
       └─ Exibe tabela com objetos da request (programa, tabela, etc.)
  └─ Botão "Consolidar" (ativo apenas após ver conteúdo)
       └─ Chama RFC_CONSOLIDATE_REQUESTS por tipo
       └─ Exibe novo DEV number resultante em destaque
```

---

## Parsing dos Comentários ADO

**Padrão reconhecido:**
```
WS
DVEXXXXXXXX
DVEXXXXXXXX

OBTI
DEVIIIIII

INSTAL
DEVX9w1

UPDATE
DEV97176781781
```

**Regras do parser:**
- Tipos válidos: `WS`, `OBTI`, `INSTAL`, `UPDATE` (case-insensitive)
- Uma linha contendo apenas um tipo válido inicia um novo grupo
- Linhas seguintes começando com `DEV` (case-insensitive) pertencem ao grupo atual
- Linhas em branco separam grupos mas não encerram o parsing
- Grupos sem nenhuma request DEV são ignorados
- O parser percorre todos os comentários do work item (não apenas o primeiro)

---

## Endpoints Novos no `api-server.js`

### `GET /api/fechamento/request-content`

Query params: `?tipo=WS&requests=DEV001,DEV002`

Operação: chama `RFC_GET_REQUEST_CONTENT` (placeholder) no SAP com tipo e lista de requests.

Resposta:
```json
{
  "success": true,
  "requests": [
    {
      "numero": "DEV001",
      "objetos": [
        { "tipo": "PROG", "nome": "ZPROGRAM01" },
        { "tipo": "TABL", "nome": "ZTABLE01" }
      ]
    }
  ]
}
```

### `POST /api/fechamento/consolidar`

Body: `{ "tipo": "WS", "requests": ["DEV001", "DEV002"] }`

Operação: chama `RFC_CONSOLIDATE_REQUESTS` (placeholder) no SAP.

Resposta:
```json
{
  "success": true,
  "novaRequest": "DEV099999",
  "tipo": "WS",
  "requestsAgrupadas": ["DEV001", "DEV002"]
}
```

---

## Interface

- Visual idêntico ao `iteracoes_ado.html`: header azul, cards de iteração, modal de work items, mesmos estilos CSS
- **Painel de Requests** (novo): exibido abaixo do modal de work items ou como modal próprio
  - Cards por tipo (`WS`, `OBTI`, `INSTAL`, `UPDATE`) com badge de quantidade
  - Lista de DEV numbers com botão ✕ por item
  - Botão "Ver Conteúdo" por card — expande tabela de objetos
  - Botão "Consolidar" por card — só habilitado após "Ver Conteúdo"
  - Após consolidação: destaque verde com novo DEV number

---

## Tratamento de Erros

- Comentários sem nenhuma request válida: mensagem "Nenhuma request ABAP encontrada nos comentários"
- RFC indisponível / erro SAP: mensagem no painel com detalhes do erro, botão para tentar novamente
- Consolidação falha parcialmente (um tipo falha, outro não): exibe resultado parcial com erros por tipo

---

## Fora do Escopo

- Autenticação de usuários
- Histórico de consolidações anteriores
- Edição manual dos DEV numbers (apenas remoção)
- Integração com Zendesk
- Nomes/parâmetros reais das RFCs SAP (preenchidos quando disponíveis)
