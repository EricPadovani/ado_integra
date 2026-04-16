# Design: Integração Zendesk → ADO Work Item

**Data:** 2026-04-15  
**Status:** Aprovado  
**Contexto:** `iteracoes_ado.html` / `busca_ado.js` / `sap-mcp-server/api-server.js`

---

## Problema

Os work items ADO frequentemente referenciam chamados Zendesk na descrição, mas não há forma automatizada de trazer o conteúdo do Zendesk (texto, comentários, anexos) para dentro do ADO. O processo hoje é manual.

---

## Solução

Adicionar uma coluna **"Zendesk"** na tabela de work items existente. Para cada item cuja descrição contenha um número de chamado Zendesk, exibir um botão **🎫 Sincronizar** que:

1. Detecta o número automaticamente via regex na descrição do ADO
2. Busca os dados do ticket no Zendesk (via proxy no `api-server.js`)
3. Exibe um modal de preview com os dados encontrados
4. Após confirmação do usuário, atualiza o ADO work item com comentário + anexos

**Nenhuma funcionalidade existente é alterada.** Apenas adições.

---

## Detecção do Número Zendesk

A regex é aplicada sobre `System.Description` do work item:

```
Ticket_(\d+)   →  ex: Ticket_180728_OBTI_...       → ID: 180728
TKT(\d+)       →  ex: TKT181297_2026 - OBTI...     → ID: 181297
```

Se nenhum padrão for encontrado, a célula da coluna "Zendesk" exibe `—` (sem botão).

---

## Fluxo Completo

```
[Tabela Work Items]
  └─ Coluna "Zendesk"
       ├─ Com ID detectado → botão "🎫 Sincronizar"
       └─ Sem ID           → "—"

[Clique em 🎫 Sincronizar]
  └─ Chama GET /api/zendesk/ticket?id=XXXXXX
  └─ Abre modal de preview com:
       - Título do ticket
       - Status / Requester
       - Número de comentários
       - Lista de anexos (nome + tamanho)
  └─ Botão "Confirmar Sincronização" / "Cancelar"

[Confirmar Sincronização]
  └─ Chama POST /api/zendesk/sync-to-ado
       Body: { workItemId, zendeskTicketId, adoToken }
  └─ Servidor:
       1. Baixa cada anexo do Zendesk
       2. Upload de cada anexo no ADO (POST /wit/attachments)
       3. PATCH no work item para linkar cada attachment
       4. POST /wit/workitems/{id}/comments com texto consolidado

[Modal resultado]
  └─ Sucesso: lista do que foi sincronizado
  └─ Erro: mensagem detalhada por operação que falhou
```

---

## Mudanças por Arquivo

### `busca_ado.js` (template gerador do HTML)

**Na função `gerarHTML` / template do `showWorkItems`:**

1. Cabeçalho da tabela: adicionar `<th>Zendesk</th>` após `<th>Verificar</th>`
2. Para cada row de work item:
   - Extrair Zendesk ID com regex sobre `fields['System.Description'] || ''`
   - Se encontrado: `<td><button class="btn-zendesk" onclick="previewZendesk(workItemId, zendeskId)">🎫 Sincronizar</button></td>`
   - Se não: `<td style="color:#aaa;text-align:center">—</td>`

**Novo modal HTML** inserido no template (separado dos modais existentes):
```
<div id="zendeskModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>🎫 Zendesk — Ticket #<span id="zdTicketId"></span></h2>
      <span class="close" onclick="closeZendeskModal()">×</span>
    </div>
    <div class="modal-body" id="zdModalBody">...</div>
  </div>
</div>
```

**Novas funções JS** no template:

| Função | Responsabilidade |
|--------|-----------------|
| `extractZendeskId(description)` | Aplica regex, retorna número ou `null` |
| `previewZendesk(workItemId, zendeskId)` | Abre modal, chama `GET /api/zendesk/ticket`, exibe preview |
| `confirmZendeskSync(workItemId, zendeskId, adoToken)` | Chama `POST /api/zendesk/sync-to-ado`, exibe progresso e resultado |
| `closeZendeskModal()` | Fecha o modal Zendesk |

---

### `sap-mcp-server/api-server.js`

Dois novos blocos `if (url.pathname === ...)` adicionados ao handler existente, **após** os endpoints já existentes e **antes** do 404 final.

#### `GET /api/zendesk/ticket`

Query param: `?id=XXXXXX`

Operações:
1. `GET https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/{id}.json`
2. `GET https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/{id}/comments.json`
3. Coleta lista de anexos de todos os comentários (campo `attachments`)

Resposta:
```json
{
  "success": true,
  "ticket": { "id", "subject", "status", "requester_id", "description" },
  "comments": [{ "id", "body", "author_id", "created_at", "attachments": [...] }],
  "attachments": [{ "id", "file_name", "content_url", "size", "content_type" }]
}
```

Auth: `Basic base64(EMAIL/token:TOKEN)` via `ZENDESK_EMAIL` e `ZENDESK_TOKEN` do `.env`.

#### `POST /api/zendesk/sync-to-ado`

Body: `{ workItemId, zendeskTicketId, adoToken }`

Operações em sequência:
1. Re-fetch dados do ticket Zendesk (idêntico ao endpoint acima)
2. Para cada anexo:
   a. Download binário via `axios.get(content_url, { responseType: 'arraybuffer' })`
   b. Upload no ADO: `POST https://dev.azure.com/tr-ggo/{project}/_apis/wit/attachments?fileName={name}&api-version=7.0` com o binário
   c. PATCH no work item para linkar o attachment retornado
3. Montar texto do comentário ADO:
   ```
   --- Zendesk Ticket #{id} ---
   Assunto: {subject}
   Status: {status}
   
   === Descrição ===
   {description}
   
   === Comentários ===
   [{author} - {created_at}]
   {body}
   ...
   
   === Anexos sincronizados ===
   - arquivo1.pdf
   - arquivo2.png
   ```
4. `POST /wit/workitems/{workItemId}/comments?api-version=7.0-preview.3` com o texto acima

Resposta:
```json
{
  "success": true,
  "attachmentsSynced": 3,
  "commentAdded": true,
  "errors": []
}
```

---

### `sap-mcp-server/.env`

Adicionar as 3 variáveis:
```
ZENDESK_SUBDOMAIN=suaempresa
ZENDESK_EMAIL=usuario@empresa.com
ZENDESK_TOKEN=seu_token_zendesk
```

---

## Estilo do Botão Zendesk

Novo estilo CSS adicionado ao template no `busca_ado.js`:
```css
.btn-zendesk {
  padding: 2px 8px;
  background: #17a589;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.btn-zendesk:hover { background: #148a72; }
.btn-zendesk:disabled { background: #aaa; cursor: default; }
```

---

## Tratamento de Erros

- Ticket Zendesk não encontrado (404): modal exibe mensagem clara, não bloqueia nada
- Zendesk inacessível / credenciais inválidas: mensagem de erro no modal
- Falha no upload de um anexo ADO: registrado em `errors[]`, demais anexos continuam
- Falha ao adicionar comentário ADO: reportado no resultado, não desfaz anexos já enviados
- Sem credenciais Zendesk no `.env`: endpoint retorna `{ success: false, error: "Credenciais Zendesk não configuradas" }`

---

## Escopo

- Alterações em: `busca_ado.js`, `sap-mcp-server/api-server.js`, `sap-mcp-server/.env`
- `iteracoes_ado.html` é regenerado ao rodar `node busca_ado.js` (comportamento já existente)
- Nenhuma funcionalidade existente é modificada ou removida
- Não há mudanças em: `package.json`, `iniciar.bat`, endpoints SAP/IA existentes
