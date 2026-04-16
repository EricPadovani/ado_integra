# Zendesk → ADO Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma coluna "Zendesk" na tabela de work items que detecta automaticamente o número do chamado Zendesk na descrição do ADO, permite buscar os dados do ticket Zendesk e sincronizá-los (comentários + anexos) de volta para o ADO work item.

**Architecture:** Backend proxy em `api-server.js` (porta 3001) expõe dois endpoints Zendesk novos — um para preview e outro para sync. O frontend (`busca_ado.js` template) adiciona coluna, botão, modal e funções JS sem alterar nada do que já existe.

**Tech Stack:** Node.js (http nativo + axios), JavaScript vanilla (browser), Zendesk REST API v2, Azure DevOps REST API 7.0

---

## Mapa de Arquivos

| Arquivo | Ação | O que muda |
|---------|------|-----------|
| `sap-mcp-server/.env` | Modificar | Adicionar 3 vars Zendesk |
| `sap-mcp-server/api-server.js` | Modificar | 2 novos endpoints antes do 404 final (linha 643) |
| `ado/busca_ado.js` | Modificar | CSS, coluna, célula, modal HTML, 4 funções JS |
| `ado/iteracoes_ado.html` | Regenerado | Executar `node busca_ado.js` ao final |

---

## Task 1: Adicionar credenciais Zendesk ao `.env`

**Files:**
- Modify: `sap-mcp-server/.env`

- [ ] **Step 1: Abrir `sap-mcp-server/.env` e adicionar as 3 linhas ao final**

```dotenv
ZENDESK_SUBDOMAIN=suaempresa
ZENDESK_EMAIL=usuario@empresa.com
ZENDESK_TOKEN=seu_token_zendesk_aqui
```

> Substituir pelos valores reais antes de testar. O `ZENDESK_SUBDOMAIN` é a parte antes de `.zendesk.com` na URL do seu Zendesk (ex: para `empresa.zendesk.com` → `empresa`).

- [ ] **Step 2: Verificar que o arquivo ficou correto**

Abrir `sap-mcp-server/.env` e confirmar que as 3 linhas estão presentes ao final, sem espaços extras.

---

## Task 2: Endpoint `GET /api/zendesk/ticket` em `api-server.js`

**Files:**
- Modify: `sap-mcp-server/api-server.js` (inserir antes da linha 643: `res.writeHead(404);`)

- [ ] **Step 1: Inserir o novo endpoint antes do bloco 404 final**

Localizar as linhas:
```javascript
  res.writeHead(404);
  res.end('Not found');
```

Inserir imediatamente ANTES delas:

```javascript
  // Zendesk: buscar ticket + comentários + anexos
  if (url.pathname === '/api/zendesk/ticket' && req.method === 'GET') {
    const zdId = url.searchParams.get('id');
    if (!zdId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parâmetro id obrigatório' }));
      return;
    }
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const email     = process.env.ZENDESK_EMAIL;
    const zdToken   = process.env.ZENDESK_TOKEN;
    if (!subdomain || !email || !zdToken) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Credenciais Zendesk não configuradas no .env' }));
      return;
    }
    const zdAuth    = Buffer.from(`${email}/token:${zdToken}`).toString('base64');
    const zdHeaders = { 'Authorization': `Basic ${zdAuth}`, 'Content-Type': 'application/json' };
    try {
      const [ticketResp, commentsResp] = await Promise.all([
        axios.get(`https://${subdomain}.zendesk.com/api/v2/tickets/${zdId}.json`, { headers: zdHeaders }),
        axios.get(`https://${subdomain}.zendesk.com/api/v2/tickets/${zdId}/comments.json`, { headers: zdHeaders })
      ]);
      const ticket   = ticketResp.data.ticket;
      const comments = commentsResp.data.comments || [];
      const attachments = [];
      comments.forEach(c => {
        (c.attachments || []).forEach(a => {
          attachments.push({ id: a.id, file_name: a.file_name, content_url: a.content_url, size: a.size, content_type: a.content_type });
        });
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success:     true,
        ticket:      { id: ticket.id, subject: ticket.subject, status: ticket.status, description: ticket.description },
        comments,
        attachments
      }));
    } catch (err) {
      const status = err.response ? err.response.status : 0;
      const msg    = status === 404 ? `Ticket #${zdId} não encontrado no Zendesk` : (err.message || String(err));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: msg }));
    }
    return;
  }

```

- [ ] **Step 2: Testar o endpoint manualmente**

Com o servidor já rodando (ou reiniciar com `node ../sap-mcp-server/api-server.js` a partir da pasta `ado`), abrir no browser:

```
http://localhost:3001/api/zendesk/ticket?id=180728
```

Resultado esperado (sucesso):
```json
{ "success": true, "ticket": { "id": 180728, "subject": "...", "status": "...", "description": "..." }, "comments": [...], "attachments": [...] }
```

Resultado esperado (sem credenciais):
```json
{ "success": false, "error": "Credenciais Zendesk não configuradas no .env" }
```

---

## Task 3: Endpoint `POST /api/zendesk/sync-to-ado` em `api-server.js`

**Files:**
- Modify: `sap-mcp-server/api-server.js` (inserir após o bloco do Task 2, ainda antes do 404)

- [ ] **Step 1: Inserir o endpoint de sync imediatamente após o bloco do Task 2 (ainda antes do 404)**

```javascript
  // Zendesk: sincronizar ticket → ADO work item (comentário + anexos)
  if (url.pathname === '/api/zendesk/sync-to-ado' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { workItemId, zendeskTicketId, adoToken } = JSON.parse(body);
        const subdomain = process.env.ZENDESK_SUBDOMAIN;
        const email     = process.env.ZENDESK_EMAIL;
        const zdToken   = process.env.ZENDESK_TOKEN;
        if (!subdomain || !email || !zdToken) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Credenciais Zendesk não configuradas no .env' }));
        }
        const ADO_ORG     = 'tr-ggo';
        const ADO_PROJECT = '9464d7d1-c63b-4af4-9399-dc57bf983384';
        const zdAuth      = Buffer.from(`${email}/token:${zdToken}`).toString('base64');
        const zdHeaders   = { 'Authorization': `Basic ${zdAuth}` };
        const adoHeaders  = { 'Authorization': `Basic ${adoToken}` };

        // 1. Buscar dados do Zendesk
        const [ticketResp, commentsResp] = await Promise.all([
          axios.get(`https://${subdomain}.zendesk.com/api/v2/tickets/${zendeskTicketId}.json`, { headers: zdHeaders }),
          axios.get(`https://${subdomain}.zendesk.com/api/v2/tickets/${zendeskTicketId}/comments.json`, { headers: zdHeaders })
        ]);
        const ticket      = ticketResp.data.ticket;
        const comments    = commentsResp.data.comments || [];
        const allAttachments = [];
        comments.forEach(c => { (c.attachments || []).forEach(a => allAttachments.push(a)); });

        const errors      = [];
        const syncedFiles = [];

        // 2. Upload de cada anexo no ADO e link no work item
        for (const att of allAttachments) {
          try {
            const fileResp = await axios.get(att.content_url, { responseType: 'arraybuffer', headers: zdHeaders });
            const uploadResp = await axios.post(
              `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/attachments?fileName=${encodeURIComponent(att.file_name)}&api-version=7.0`,
              Buffer.from(fileResp.data),
              { headers: { ...adoHeaders, 'Content-Type': 'application/octet-stream' } }
            );
            const attUrl = uploadResp.data.url;
            await axios.patch(
              `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
              [{ op: 'add', path: '/relations/-', value: { rel: 'AttachedFile', url: attUrl, attributes: { comment: 'Sincronizado do Zendesk' } } }],
              { headers: { ...adoHeaders, 'Content-Type': 'application/json-patch+json' } }
            );
            syncedFiles.push(att.file_name);
          } catch (attErr) {
            errors.push(`Anexo "${att.file_name}": ${attErr.message}`);
          }
        }

        // 3. Montar e adicionar comentário no ADO
        const commentLines = [
          `<b>--- Zendesk Ticket #${ticket.id} ---</b>`,
          `<b>Assunto:</b> ${ticket.subject}`,
          `<b>Status:</b> ${ticket.status}`,
          '',
          '<b>=== Descrição ===</b>',
          ticket.description || '',
          ''
        ];
        comments.forEach((c, i) => {
          if (i === 0) return;
          commentLines.push(`<b>[Comentário ${i} — ${new Date(c.created_at).toLocaleString('pt-BR')}]</b>`);
          commentLines.push(c.plain_body || c.body || '');
          commentLines.push('');
        });
        if (syncedFiles.length > 0) {
          commentLines.push('<b>=== Anexos sincronizados ===</b>');
          syncedFiles.forEach(f => commentLines.push(`• ${f}`));
        }

        let commentAdded = false;
        try {
          await axios.post(
            `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}/comments?api-version=7.0-preview.3`,
            { text: commentLines.join('<br>') },
            { headers: { ...adoHeaders, 'Content-Type': 'application/json' } }
          );
          commentAdded = true;
        } catch (commentErr) {
          errors.push(`Comentário ADO: ${commentErr.message}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, attachmentsSynced: syncedFiles.length, syncedFiles, commentAdded, errors }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
      }
    });
    return;
  }

```

- [ ] **Step 2: Reiniciar o servidor e testar via curl**

```bash
curl -X POST http://localhost:3001/api/zendesk/sync-to-ado \
  -H "Content-Type: application/json" \
  -d "{\"workItemId\":\"12345\",\"zendeskTicketId\":\"180728\",\"adoToken\":\"SEU_TOKEN_ADO\"}"
```

Resultado esperado:
```json
{ "success": true, "attachmentsSynced": 2, "syncedFiles": ["doc.pdf", "img.png"], "commentAdded": true, "errors": [] }
```

---

## Task 4: CSS do botão Zendesk em `busca_ado.js`

**Files:**
- Modify: `ado/busca_ado.js`

- [ ] **Step 1: Localizar o CSS do `.btn-analise-ia:disabled` (linha ~380) e inserir o estilo do btn-zendesk logo após**

Localizar:
```javascript
        .btn-analise-ia:disabled { opacity: 0.5; cursor: not-allowed; }
```

Substituir por:
```javascript
        .btn-analise-ia:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-zendesk {
            padding: 3px 8px;
            background: #17a589;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
            font-weight: 600;
        }
        .btn-zendesk:hover { background: #148a72; }
        .btn-zendesk:disabled { background: #aaa; cursor: not-allowed; }
```

---

## Task 5: Coluna "Zendesk" no cabeçalho e célula em cada linha

**Files:**
- Modify: `ado/busca_ado.js` (linhas ~547 e ~568)

- [ ] **Step 1: Adicionar `<th>Zendesk</th>` ao cabeçalho da tabela**

Localizar (linha ~547):
```javascript
                    html += '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th><th>Verificar</th></tr></thead><tbody>';
```

Substituir por:
```javascript
                    html += '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th><th>Verificar</th><th>Zendesk</th></tr></thead><tbody>';
```

- [ ] **Step 2: Adicionar detecção de Zendesk ID e célula em cada linha de work item**

Localizar o bloco que começa com (linha ~564):
```javascript
                                if (fields['System.WorkItemType'] === 'User Story') {
                                    userStoryCount++;
                                    const assignee = (fields['System.AssignedTo'] && fields['System.AssignedTo'].displayName) || '-';
                                    if (assignee !== '-') usersSet.add(assignee);
                                    html += '<tr data-user="' + assignee.replace(/"/g, '&quot;') + '"><td><a href="#" class="workitem-id"
```

Logo após `if (assignee !== '-') usersSet.add(assignee);` e ANTES da linha longa do `html +=`, inserir:

```javascript
                                    const desc = fields['System.Description'] || '';
                                    const zdMatch = desc.match(/Ticket_(\d+)/i) || desc.match(/TKT(\d+)/i);
                                    const zdId = zdMatch ? zdMatch[1] : null;
                                    const zdCell = zdId
                                        ? '<td><button class="btn-zendesk" onclick="previewZendesk(' + workItemData.id + ', \'' + zdId + '\')">🎫 Sincronizar</button></td>'
                                        : '<td style="color:#aaa;text-align:center;font-size:12px">—</td>';
```

- [ ] **Step 3: Adicionar `+ zdCell` ao final da linha longa do `html +=` (antes de `</tr>`)**

A linha longa (linha ~568) termina com:
```javascript
...Verificar</button></td></tr>';
```

Substituir o final dessa string:
```javascript
...Verificar</button></td>' + zdCell + '</tr>';
```

> **Atenção:** essa é a linha mais longa do arquivo. Encontre o final `</td></tr>';` que encerra o User Story row e substitua apenas esse trecho final.

---

## Task 6: Modal Zendesk e funções JS em `busca_ado.js`

**Files:**
- Modify: `ado/busca_ado.js`

- [ ] **Step 1: Adicionar o modal Zendesk antes de `</body>` no template**

Localizar (linha ~1279):
```javascript
</body>
</html>`;
```

Substituir por:
```javascript

    <!-- Modal Zendesk -->
    <div id="zendeskModal" class="modal">
        <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, #17a589 0%, #0e6b57 100%);">
                <h2 id="zdModalTitle" style="font-size:1em">🎫 Zendesk</h2>
                <span class="close" onclick="closeZendeskModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="zdModalBody" style="padding:16px;overflow-y:auto;max-height:calc(80vh - 80px);background:#f4f6f8;color:#374151;"></div>
            </div>
        </div>
    </div>

</body>
</html>`;
```

- [ ] **Step 2: Adicionar a função `closeZendeskModal` após `closeAnaliseModal`**

Localizar (linha ~1263):
```javascript
        function closeAnaliseModal() {
            document.getElementById('analiseModal').style.display = 'none';
        }
```

Inserir logo após:
```javascript

        function closeZendeskModal() {
            document.getElementById('zendeskModal').style.display = 'none';
        }
```

- [ ] **Step 3: Estender o window click handler para fechar o modal Zendesk**

Localizar o bloco do window.onclick (linha ~1270):
```javascript
        window.onclick = function(event) {
            const modal = document.getElementById('workItemsModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
            if (event.target === document.getElementById('analiseModal')) {
                closeAnaliseModal();
            }
        }
```

Substituir por:
```javascript
        window.onclick = function(event) {
            const modal = document.getElementById('workItemsModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
            if (event.target === document.getElementById('analiseModal')) {
                closeAnaliseModal();
            }
            if (event.target === document.getElementById('zendeskModal')) {
                closeZendeskModal();
            }
        }
```

- [ ] **Step 4: Adicionar as funções `previewZendesk` e `confirmZendeskSync` antes de `</script>`**

Localizar (linha ~1278):
```javascript
    </script>
```

Inserir imediatamente ANTES:
```javascript

        async function previewZendesk(workItemId, zendeskId) {
            const modal   = document.getElementById('zendeskModal');
            const title   = document.getElementById('zdModalTitle');
            const body    = document.getElementById('zdModalBody');
            title.textContent = '🎫 Zendesk — Ticket #' + zendeskId;
            body.innerHTML = '<div class="loading">⏳ Buscando dados do Zendesk...</div>';
            modal.style.display = 'block';

            try {
                const resp = await fetch('http://localhost:3001/api/zendesk/ticket?id=' + zendeskId);
                const data = await resp.json();

                if (!data.success) {
                    body.innerHTML = '<div class="error">❌ ' + (data.error || 'Erro ao buscar ticket') + '</div>';
                    return;
                }

                const t = data.ticket;
                const attachmentRows = data.attachments.map(function(a) {
                    const kb = a.size ? ' (' + Math.round(a.size / 1024) + ' KB)' : '';
                    return '<li style="font-size:12px;margin:2px 0">📎 ' + a.file_name + kb + '</li>';
                }).join('');

                body.innerHTML =
                    '<table class="detail-table" style="margin-bottom:12px">' +
                    '<tr><td style="font-weight:600;width:120px">Ticket</td><td>#' + t.id + '</td></tr>' +
                    '<tr><td style="font-weight:600">Assunto</td><td>' + (t.subject || '-') + '</td></tr>' +
                    '<tr><td style="font-weight:600">Status</td><td>' + (t.status || '-') + '</td></tr>' +
                    '<tr><td style="font-weight:600">Comentários</td><td>' + data.comments.length + '</td></tr>' +
                    '<tr><td style="font-weight:600">Anexos</td><td>' + data.attachments.length + '</td></tr>' +
                    '</table>' +
                    (data.attachments.length > 0
                        ? '<div style="margin-bottom:12px"><strong>Arquivos que serão sincronizados:</strong><ul style="margin:6px 0 0 16px">' + attachmentRows + '</ul></div>'
                        : '') +
                    '<div style="display:flex;gap:8px;margin-top:16px">' +
                    '<button class="btn-analise-ia" style="background:#17a589" onclick="confirmZendeskSync(' + workItemId + ', \'' + zendeskId + '\', this)">✅ Confirmar Sincronização</button>' +
                    '<button class="btn-analise-ia" style="background:#6c757d" onclick="closeZendeskModal()">Cancelar</button>' +
                    '</div>';
            } catch (err) {
                body.innerHTML = '<div class="error">❌ Erro de conexão: ' + err.message + '</div>';
            }
        }

        async function confirmZendeskSync(workItemId, zendeskId, btn) {
            const body = document.getElementById('zdModalBody');
            if (btn) btn.disabled = true;
            body.innerHTML += '<div class="loading" style="margin-top:12px">⏳ Sincronizando com ADO...</div>';

            try {
                const resp = await fetch('http://localhost:3001/api/zendesk/sync-to-ado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workItemId: workItemId, zendeskTicketId: zendeskId, adoToken: '${token}' })
                });
                const data = await resp.json();

                if (!data.success) {
                    body.innerHTML = '<div class="error">❌ ' + (data.error || 'Erro na sincronização') + '</div>';
                    return;
                }

                const syncedList = (data.syncedFiles || []).map(function(f) {
                    return '<li style="font-size:12px;margin:2px 0">📎 ' + f + '</li>';
                }).join('');

                const errorList = (data.errors || []).map(function(e) {
                    return '<li style="font-size:12px;color:#c0392b;margin:2px 0">⚠️ ' + e + '</li>';
                }).join('');

                body.innerHTML =
                    '<div style="background:#d4edda;border-left:4px solid #28a745;padding:10px 14px;border-radius:4px;margin-bottom:12px">' +
                    '✅ <strong>Sincronização concluída!</strong></div>' +
                    '<table class="detail-table">' +
                    '<tr><td style="font-weight:600;width:160px">Comentário ADO</td><td>' + (data.commentAdded ? '✅ Adicionado' : '❌ Falhou') + '</td></tr>' +
                    '<tr><td style="font-weight:600">Anexos sincronizados</td><td>' + data.attachmentsSynced + '</td></tr>' +
                    '</table>' +
                    (syncedList ? '<ul style="margin:8px 0 0 16px">' + syncedList + '</ul>' : '') +
                    (errorList  ? '<div style="margin-top:10px"><strong>Erros:</strong><ul style="margin:4px 0 0 16px">' + errorList + '</ul></div>' : '') +
                    '<button class="btn-analise-ia" style="background:#6c757d;margin-top:14px" onclick="closeZendeskModal()">Fechar</button>';
            } catch (err) {
                body.innerHTML = '<div class="error">❌ Erro de conexão: ' + err.message + '</div>';
            }
        }

```

---

## Task 7: Regenerar HTML e testar end-to-end

**Files:**
- Run: `node ado/busca_ado.js` (a partir de `C:\vscode`)
- Verify: `ado/iteracoes_ado.html` regenerado

- [ ] **Step 1: Regenerar o HTML**

Na pasta `C:\vscode\ado`, executar:
```bash
node busca_ado.js
```

Esperado: sem erros, arquivo `iteracoes_ado.html` atualizado.

Se houver erro de sintaxe no template, o Node.js apontará a linha. Corrigir e repetir.

- [ ] **Step 2: Reiniciar o servidor**

Fechar o servidor anterior (se estiver rodando) e iniciar novamente:
```bash
node ../sap-mcp-server/api-server.js
```

Ou executar o `iniciar.bat` normalmente.

- [ ] **Step 3: Verificar que a coluna Zendesk aparece na tabela**

1. Abrir `iteracoes_ado.html` no browser
2. Clicar em uma iteração para abrir o modal de work items
3. Confirmar que o cabeçalho da tabela agora tem coluna "Zendesk"
4. Para work items com descrição contendo `Ticket_XXXXXX` ou `TKT XXXXXX`: botão "🎫 Sincronizar" aparece
5. Para work items sem esse padrão: célula exibe "—"

- [ ] **Step 4: Testar o fluxo de preview**

1. Clicar em "🎫 Sincronizar" em um work item que tem Zendesk na descrição
2. Modal Zendesk abre com spinner "Buscando dados do Zendesk..."
3. Dados do ticket aparecem: assunto, status, contagem de comentários, lista de anexos
4. Botões "Confirmar Sincronização" e "Cancelar" visíveis

- [ ] **Step 5: Testar a sincronização**

1. Na modal de preview, clicar "✅ Confirmar Sincronização"
2. Spinner "Sincronizando com ADO..." aparece
3. Modal exibe resultado com:
   - "Comentário ADO: ✅ Adicionado"
   - Número de anexos sincronizados
   - Lista de arquivos sincronizados
   - Erros, se houver (não bloqueiam o resultado)
4. Verificar no Azure DevOps (web) que:
   - O work item tem um novo comentário com os dados do Zendesk
   - Os anexos estão linkados ao work item

- [ ] **Step 6: Confirmar que funcionalidades existentes não foram afetadas**

1. Botão "Verificar" ainda abre o modal de análise com as opções "Analisar ADO e Programa" e "Executar RFC / Validar"
2. Filtro de usuário no modal de work items ainda funciona
3. Modal de análise IA (pontos ajustados, RFC, validação) abre e funciona normalmente
4. Clicar fora dos modais ainda os fecha
