# Fechamento ABAP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o projeto `C:\vscode\fechamento\` — HTML gerado por Node.js que permite selecionar iterações ADO, visualizar work items, extrair requests ABAP dos comentários, consultar conteúdo via RFC SAP e consolidá-las em uma nova request por tipo.

**Architecture:** `fechamento.js` (cópia adaptada de `busca_ado.js`) gera `fechamento.html`. O HTML é servido por `api-server.js` em `GET /fechamento`, permitindo caminhos relativos `/api/fechamento/...`. Dois novos endpoints são adicionados ao `api-server.js` para as RFCs (com mocks enquanto RFCs reais não estão definidas). O projeto `ado` e o `busca_ado.js` não são alterados.

**Tech Stack:** Node.js (dotenv, axios), JavaScript vanilla, Azure DevOps REST API 7.0, SAP RFC via api-server.js existente

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `C:\vscode\fechamento\package.json` | Criar | Dependências do projeto |
| `C:\vscode\fechamento\.env` | Criar | ADO_TOKEN (cópia do ado/.env) |
| `C:\vscode\fechamento\iniciar.bat` | Criar | Gera HTML, inicia servidor, abre browser |
| `C:\vscode\fechamento\fechamento.js` | Criar | Gerador do HTML (cópia adaptada do busca_ado.js) |
| `C:\vscode\fechamento\fechamento.html` | Gerado | HTML final (não editar manualmente) |
| `C:\vscode\sap-mcp-server\api-server.js` | Modificar | Rota GET /fechamento + 2 endpoints RFC |

---

### Task 1: Criar estrutura do projeto `fechamento`

**Files:**
- Create: `C:\vscode\fechamento\package.json`
- Create: `C:\vscode\fechamento\.env`
- Create: `C:\vscode\fechamento\iniciar.bat`

- [ ] **Step 1: Criar `package.json`**

Criar o arquivo `C:\vscode\fechamento\package.json`:

```json
{
  "name": "fechamento",
  "version": "1.0.0",
  "main": "fechamento.js",
  "scripts": {
    "gerar": "node fechamento.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

```bash
cd /c/vscode/fechamento && npm install
```

Esperado: criação de `node_modules/` e `package-lock.json` sem erros.

- [ ] **Step 3: Criar `.env`**

Criar `C:\vscode\fechamento\.env` copiando o token do projeto ado:

```
ADO_TOKEN=QmFzaWM6QXhaUDFPbzJVY0dZd1VGMVZYTVNtN01CRkI4Z1lVVXc3WGJPN1ZQYWI1S01mbkc0UmdjS0pRUUo5OUNEQUNBQUFBQURZZWVVQUFBU0FaRE80R2Fy
```

> Copiar o valor exato de `C:\vscode\ado\.env` (campo `ADO_TOKEN`).

- [ ] **Step 4: Criar `iniciar.bat`**

Criar `C:\vscode\fechamento\iniciar.bat`:

```bat
@echo off
title Fechamento ABAP
cd /d "%~dp0"

echo.
echo ============================================
echo   Fechamento ABAP - Consolidacao de Requests
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Gerando fechamento.html...
node fechamento.js
if errorlevel 1 (
    echo [ERRO] Falha ao gerar HTML. Verifique o arquivo .env
    pause
    exit /b 1
)

echo [2/3] Iniciando servidor SAP + IA (se nao estiver rodando)...
netstat -ano 2>nul | findstr ":3001 " >nul 2>&1
if errorlevel 1 (
    start "" /B node "..\sap-mcp-server\api-server.js"
    timeout /t 2 /nobreak >nul
    echo     Servidor iniciado.
) else (
    echo     Servidor ja esta rodando na porta 3001.
)

echo [3/3] Abrindo no browser...
start "" "http://localhost:3001/fechamento"

echo.
echo Pronto! Acesse: http://localhost:3001/fechamento
pause
```

- [ ] **Step 5: Verificar estrutura criada**

```bash
ls /c/vscode/fechamento/
```

Esperado: `package.json`, `.env`, `iniciar.bat`, `node_modules/`, `package-lock.json`.

---

### Task 2: Criar `fechamento.js` — cópia base de `busca_ado.js`

**Files:**
- Create: `C:\vscode\fechamento\fechamento.js`

- [ ] **Step 1: Copiar `busca_ado.js` para `fechamento.js`**

```bash
cp /c/vscode/ado/busca_ado.js /c/vscode/fechamento/fechamento.js
```

- [ ] **Step 2: Ajustar o `require('dotenv')` para ler `.env` da própria pasta**

Em `fechamento.js`, a primeira linha é:
```javascript
require('dotenv').config();
```

Substituir por:
```javascript
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const fs   = require('fs');
```

> Isso garante que o `.env` lido é o de `fechamento/`, não o do diretório onde o comando é executado. As variáveis `path` e `fs` são usadas em `salvarHTML`.

- [ ] **Step 3: Trocar o título da página**

Localizar em `fechamento.js`:
```javascript
    <title>Iterações Azure DevOps</title>
```

Substituir por:
```javascript
    <title>Fechamento ABAP — Consolidação de Requests</title>
```

- [ ] **Step 4: Trocar o texto do header**

Localizar:
```javascript
            <span class="header-title">🔄 Iterações Azure DevOps — Mastersaf Interfaces</span>
```

Substituir por:
```javascript
            <span class="header-title">📦 Fechamento ABAP — Consolidação de Requests</span>
```

- [ ] **Step 5: Alterar o nome do arquivo gerado**

Localizar:
```javascript
function salvarHTML(html, nomeArquivo = 'iteracoes_ado.html') {
```

Substituir por:
```javascript
function salvarHTML(html, nomeArquivo = 'fechamento.html') {
```

- [ ] **Step 6: Testar geração inicial**

```bash
cd /c/vscode/fechamento && node fechamento.js
```

Esperado: `fechamento.html` gerado sem erros. Saída no terminal:
```
Buscando iterações do Azure DevOps...
Gerando arquivo HTML...
✅ Arquivo HTML gerado: fechamento.html
```

---

### Task 3: Remover código Zendesk de `fechamento.js`

**Files:**
- Modify: `C:\vscode\fechamento\fechamento.js`

- [ ] **Step 1: Remover CSS do btn-zendesk**

Localizar o bloco (linhas ~383–394 após a cópia):
```javascript
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

Substituir por string vazia (remover completamente).

- [ ] **Step 2: Remover coluna Zendesk do cabeçalho e adicionar coluna Requests**

Localizar:
```javascript
html += '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th><th>Verificar</th><th>Zendesk</th></tr></thead><tbody>';
```

Substituir por:
```javascript
html += '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th><th>Verificar</th><th>Requests</th></tr></thead><tbody>';
```

- [ ] **Step 3: Substituir variáveis Zendesk pela célula de Requests na linha do work item**

Localizar o bloco de 5 linhas:
```javascript
                                    const desc = (fields['System.Title'] || '') + ' ' + (fields['System.Description'] || '');
                                    const zdMatch = desc.match(/Ticket_(\\d+)/i) || desc.match(/TKT(\\d+)/i);
                                    const zdId = zdMatch ? zdMatch[1] : null;
                                    const zdCell = zdId
                                        ? '<td><button class="btn-zendesk" onclick="previewZendesk(' + workItemData.id + ', ' + zdId + ')">🎫 Sincronizar</button></td>'
                                        : '<td style="color:#aaa;text-align:center;font-size:12px">—</td>';
```

Substituir por:
```javascript
                                    const requestCell = '<td><button class="btn-requests" onclick="abrirFechamento(' + workItemData.id + ')">📦 Requests</button></td>';
```

- [ ] **Step 4: Trocar `zdCell` por `requestCell` no final da linha longa do work item**

Localizar o final da linha que gera o `<tr>` do work item. A linha contém `+ zdCell + '</tr>';` — substituir apenas essa parte final:

De:
```javascript
</button></td>' + zdCell + '</tr>';
```

Para:
```javascript
</button></td>' + requestCell + '</tr>';
```

- [ ] **Step 5: Remover a função `handleWorkItemClick`**

Localizar e remover o bloco inteiro:
```javascript
        function handleWorkItemClick(workItemId, workItemTitle) {
            // Função preparada para futuras implementações de API
            console.log('Work Item clicado:', workItemId, workItemTitle);

            // Exemplo de alert - pode ser substituído por chamada de API
            alert('Work Item ID: ' + workItemId + '\\nTítulo: ' + workItemTitle + '\\n\\nAqui pode ser implementada uma chamada de API futura!');

            // TODO: Implementar chamada de API aqui
            // Exemplo:
            // fetchWorkItemDetails(workItemId);
        }
```

Substituir por string vazia (remover).

- [ ] **Step 6: Remover função `closeZendeskModal`**

Localizar e remover:
```javascript
        function closeZendeskModal() {
            document.getElementById('zendeskModal').style.display = 'none';
        }
```

- [ ] **Step 7: Remover funções `previewZendesk` e `confirmZendeskSync`**

Localizar e remover o bloco inteiro que começa com:
```javascript
        async function previewZendesk(workItemId, zendeskId) {
```
... até o fechamento de `confirmZendeskSync` (o `}` seguido de uma linha em branco e `    </script>`).

O bloco termina com:
```javascript
        }

    </script>
```

Remover tudo de `async function previewZendesk` até (mas não incluindo) `    </script>`.

- [ ] **Step 8: Remover referência ao zendeskModal no window.onclick**

Localizar:
```javascript
            if (event.target === document.getElementById('zendeskModal')) {
                closeZendeskModal();
            }
```

Substituir por string vazia (remover).

- [ ] **Step 9: Remover o modal Zendesk**

Localizar e remover o bloco HTML:
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
```

- [ ] **Step 10: Testar geração sem Zendesk**

```bash
cd /c/vscode/fechamento && node fechamento.js
```

Abrir `fechamento.html` no browser, clicar em uma iteração — verificar que a coluna "Zendesk" sumiu e a coluna "Requests" apareceu com botões "📦 Requests".

---

### Task 4: Adicionar CSS, parser ABAP e funções do painel de requests

**Files:**
- Modify: `C:\vscode\fechamento\fechamento.js`

- [ ] **Step 1: Adicionar CSS do btn-requests e cards de requests**

Localizar em `fechamento.js`:
```javascript
        .btn-analise-ia:disabled { opacity: 0.5; cursor: not-allowed; }
```

Substituir por:
```javascript
        .btn-analise-ia:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-requests {
            padding: 3px 8px;
            background: #2c5f8a;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
            font-weight: 600;
        }
        .btn-requests:hover { background: #1e4d8c; }
        .btn-requests:disabled { background: #aaa; cursor: not-allowed; }

        .requests-card {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            margin-bottom: 12px;
            overflow: hidden;
        }
        .requests-card-header {
            background: #1e4d8c;
            color: white;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .requests-card-header h3 { font-size: 13px; font-weight: 700; margin: 0; }
        .requests-card-body { padding: 10px 14px; }
        .request-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #f0f0f0;
            font-size: 12px;
            font-family: monospace;
        }
        .request-item:last-child { border-bottom: none; }
        .btn-remover {
            background: none;
            border: none;
            color: #c0392b;
            cursor: pointer;
            font-size: 14px;
            padding: 0 4px;
            line-height: 1;
        }
        .btn-remover:hover { color: #922b21; }
        .requests-content-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 8px;
        }
        .requests-content-table th {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 4px 8px;
            text-align: left;
        }
        .requests-content-table td {
            border: 1px solid #dee2e6;
            padding: 4px 8px;
        }
        .resultado-consolidacao {
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 10px 14px;
            border-radius: 4px;
            margin-top: 12px;
            font-size: 13px;
        }
        .resultado-consolidacao strong { font-size: 15px; color: #155724; }
```

- [ ] **Step 2: Adicionar função `parseAbapRequests` ao template**

Localizar no template de `fechamento.js` a linha:
```javascript
        function filterTable(status, button) {
```

Inserir imediatamente ANTES:
```javascript
        function parseAbapRequests(textoComentarios) {
            var tiposValidos = ['WS', 'OBTI', 'INSTAL', 'UPDATE'];
            var grupos = {};
            var tipoAtual = null;
            var linhas = textoComentarios.split(/\r?\n/);
            for (var i = 0; i < linhas.length; i++) {
                var l = linhas[i].trim();
                var lUpper = l.toUpperCase();
                if (tiposValidos.indexOf(lUpper) !== -1) {
                    tipoAtual = lUpper;
                    if (!grupos[tipoAtual]) grupos[tipoAtual] = [];
                } else if (tipoAtual && /^DEV/i.test(l) && l.length > 3) {
                    grupos[tipoAtual].push(l);
                }
            }
            Object.keys(grupos).forEach(function(k) {
                if (grupos[k].length === 0) delete grupos[k];
            });
            return grupos;
        }

        function renderFechamentoPainel(grupos) {
            var body = document.getElementById('fechamentoModalBody');
            var tipos = Object.keys(grupos);
            if (tipos.length === 0) {
                body.innerHTML = '<div class="error">Nenhuma request ABAP encontrada nos comentários deste work item.</div>';
                return;
            }
            var html = '';
            tipos.forEach(function(tipo) {
                var requests = grupos[tipo];
                html += '<div class="requests-card" id="card-' + tipo + '">';
                html += '<div class="requests-card-header">';
                html += '<h3>📦 ' + tipo + ' <span style="font-weight:400;font-size:11px;opacity:0.8">(' + requests.length + ' request' + (requests.length > 1 ? 's' : '') + ')</span></h3>';
                html += '<div style="display:flex;gap:6px">';
                html += '<button class="btn-requests" onclick="verConteudoRequests(\'' + tipo + '\')" id="btn-ver-' + tipo + '">🔍 Ver Conteúdo</button>';
                html += '<button class="btn-requests" style="background:#27ae60" onclick="consolidarRequests(\'' + tipo + '\')" id="btn-cons-' + tipo + '" disabled>✅ Consolidar</button>';
                html += '</div></div>';
                html += '<div class="requests-card-body">';
                requests.forEach(function(req, idx) {
                    html += '<div class="request-item" id="req-' + tipo + '-' + idx + '">';
                    html += '<span>' + req + '</span>';
                    html += '<button class="btn-remover" onclick="removerRequest(\'' + tipo + '\',' + idx + ')" title="Remover esta request">✕</button>';
                    html += '</div>';
                });
                html += '<div id="conteudo-' + tipo + '" style="display:none;margin-top:8px"></div>';
                html += '<div id="resultado-' + tipo + '" style="margin-top:4px"></div>';
                html += '</div></div>';
            });
            body.innerHTML = html;
        }

        async function abrirFechamento(workItemId) {
            var modal = document.getElementById('fechamentoModal');
            var body  = document.getElementById('fechamentoModalBody');
            var title = document.getElementById('fechamentoModalTitle');
            title.textContent = 'Requests ABAP — Work Item #' + workItemId;
            body.innerHTML = '<div class="loading">⏳ Buscando comentários do work item...</div>';
            modal.style.display = 'block';

            try {
                var resp = await fetch(
                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                    { headers: { 'Authorization': 'Basic ${token}', 'Content-Type': 'application/json' } }
                );
                if (!resp.ok) throw new Error('Erro ADO: ' + resp.status + ' ' + resp.statusText);
                var data = await resp.json();

                var textoTotal = (data.comments || []).map(function(c) {
                    return c.text || '';
                }).join('\\n');

                var grupos = parseAbapRequests(textoTotal);
                window._fechamentoGrupos = JSON.parse(JSON.stringify(grupos));
                window._fechamentoWorkItemId = workItemId;
                renderFechamentoPainel(grupos);

            } catch (err) {
                body.innerHTML = '<div class="error">❌ Erro ao buscar comentários: ' + err.message + '</div>';
            }
        }

        function removerRequest(tipo, idx) {
            var grupos = window._fechamentoGrupos;
            if (!grupos || !grupos[tipo]) return;
            grupos[tipo].splice(idx, 1);
            if (grupos[tipo].length === 0) delete grupos[tipo];
            renderFechamentoPainel(grupos);
        }

        async function verConteudoRequests(tipo) {
            var grupos = window._fechamentoGrupos;
            if (!grupos || !grupos[tipo] || grupos[tipo].length === 0) return;

            var btnVer     = document.getElementById('btn-ver-' + tipo);
            var btnCons    = document.getElementById('btn-cons-' + tipo);
            var divConteudo = document.getElementById('conteudo-' + tipo);

            btnVer.disabled = true;
            btnVer.textContent = '⏳ Buscando...';
            divConteudo.style.display = 'none';
            divConteudo.innerHTML = '';

            try {
                var params = 'tipo=' + encodeURIComponent(tipo) + '&requests=' + grupos[tipo].map(encodeURIComponent).join(',');
                var resp = await fetch('/api/fechamento/request-content?' + params);
                var data = await resp.json();

                if (!data.success) {
                    divConteudo.innerHTML = '<div class="error" style="margin-top:8px">❌ ' + (data.error || 'Erro ao buscar conteúdo') + '</div>';
                    divConteudo.style.display = 'block';
                    btnVer.disabled = false;
                    btnVer.textContent = '🔍 Ver Conteúdo';
                    return;
                }

                var tableHtml = '<div style="margin-top:4px">';
                (data.requests || []).forEach(function(r) {
                    tableHtml += '<div style="margin-bottom:10px"><strong style="font-size:12px;font-family:monospace;color:#1e4d8c">' + r.numero + '</strong>';
                    if (r.objetos && r.objetos.length > 0) {
                        tableHtml += '<table class="requests-content-table"><thead><tr><th>Tipo</th><th>Objeto</th></tr></thead><tbody>';
                        r.objetos.forEach(function(obj) {
                            tableHtml += '<tr><td>' + (obj.tipo || '') + '</td><td>' + (obj.nome || '') + '</td></tr>';
                        });
                        tableHtml += '</tbody></table>';
                    } else {
                        tableHtml += '<div style="color:#aaa;font-size:11px;margin-top:4px">Sem objetos</div>';
                    }
                    tableHtml += '</div>';
                });
                tableHtml += '</div>';

                divConteudo.innerHTML = tableHtml;
                divConteudo.style.display = 'block';
                btnVer.textContent = '✅ Conteúdo carregado';
                btnCons.disabled = false;

            } catch (err) {
                divConteudo.innerHTML = '<div class="error" style="margin-top:8px">❌ Erro de conexão: ' + err.message + '</div>';
                divConteudo.style.display = 'block';
                btnVer.disabled = false;
                btnVer.textContent = '🔍 Ver Conteúdo';
            }
        }

        async function consolidarRequests(tipo) {
            var grupos   = window._fechamentoGrupos;
            if (!grupos || !grupos[tipo] || grupos[tipo].length === 0) return;

            var btnCons   = document.getElementById('btn-cons-' + tipo);
            var divResult = document.getElementById('resultado-' + tipo);

            btnCons.disabled = true;
            btnCons.textContent = '⏳ Consolidando...';
            divResult.innerHTML = '';

            try {
                var resp = await fetch('/api/fechamento/consolidar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo: tipo, requests: grupos[tipo] })
                });
                var data = await resp.json();

                if (!data.success) {
                    divResult.innerHTML = '<div class="error" style="margin-top:8px">❌ ' + (data.error || 'Erro na consolidação') + '</div>';
                    btnCons.disabled = false;
                    btnCons.textContent = '✅ Consolidar';
                    return;
                }

                divResult.innerHTML =
                    '<div class="resultado-consolidacao">' +
                    '✅ Consolidação concluída!<br>' +
                    'Nova request: <strong>' + data.novaRequest + '</strong><br>' +
                    '<span style="font-size:11px;color:#555">Agrupadas: ' + (data.requestsAgrupadas || []).join(', ') + '</span>' +
                    '</div>';
                btnCons.textContent = '✅ Consolidado';

            } catch (err) {
                divResult.innerHTML = '<div class="error" style="margin-top:8px">❌ Erro de conexão: ' + err.message + '</div>';
                btnCons.disabled = false;
                btnCons.textContent = '✅ Consolidar';
            }
        }

        function closeFechamentoModal() {
            document.getElementById('fechamentoModal').style.display = 'none';
            window._fechamentoGrupos = null;
            window._fechamentoWorkItemId = null;
        }

```

- [ ] **Step 3: Registrar fechamentoModal no window.onclick**

Localizar:
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
            if (event.target === document.getElementById('fechamentoModal')) {
                closeFechamentoModal();
            }
        }
```

- [ ] **Step 4: Adicionar o modal de Fechamento antes de `</body>`**

Localizar no final do template:
```javascript
</body>
</html>`;
```

Substituir por:
```javascript

    <!-- Modal Fechamento ABAP -->
    <div id="fechamentoModal" class="modal">
        <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, #1e4d8c 0%, #0d2137 100%);">
                <h2 id="fechamentoModalTitle" style="font-size:1em">📦 Requests ABAP</h2>
                <span class="close" onclick="closeFechamentoModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="fechamentoModalBody" style="padding:16px;overflow-y:auto;max-height:calc(80vh - 80px);background:#f4f6f8;"></div>
            </div>
        </div>
    </div>

</body>
</html>`;
```

- [ ] **Step 5: Testar geração com o painel**

```bash
cd /c/vscode/fechamento && node fechamento.js
```

Abrir `fechamento.html` no browser, clicar na coluna "Requests" de um work item. Esperado: modal "📦 Requests ABAP" abre com spinner. Se o work item não tiver comentários no padrão ABAP, exibe "Nenhuma request ABAP encontrada". Verificar no console do browser que não há erros JS.

- [ ] **Step 6: Commit**

```bash
cd /c/vscode/fechamento && git add fechamento.js && git commit -m "feat: adiciona painel de requests ABAP com parser, ver conteúdo e consolidar"
```

---

### Task 5: Adicionar rota `/fechamento` e endpoints RFC no `api-server.js`

**Files:**
- Modify: `C:\vscode\sap-mcp-server\api-server.js`

- [ ] **Step 1: Adicionar constante `FECHAMENTO_FILE`**

Localizar no início de `api-server.js`:
```javascript
const HTML_FILE = path.join(__dirname, '..', 'ado', 'iteracoes_ado.html');
```

Substituir por:
```javascript
const HTML_FILE       = path.join(__dirname, '..', 'ado', 'iteracoes_ado.html');
const FECHAMENTO_FILE = path.join(__dirname, '..', 'fechamento', 'fechamento.html');
```

- [ ] **Step 2: Adicionar rota `GET /fechamento`**

Localizar o bloco que serve o HTML principal:
```javascript
  // Serve HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Erro ao carregar a aplicação: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
```

Inserir imediatamente APÓS esse bloco:
```javascript

  // Serve Fechamento HTML
  if (url.pathname === '/fechamento') {
    fs.readFile(FECHAMENTO_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Erro ao carregar fechamento.html: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

```

- [ ] **Step 3: Adicionar endpoints RFC do fechamento antes do bloco 404**

Localizar:
```javascript
  res.writeHead(404);
  res.end('Not found');
```

Inserir imediatamente ANTES:
```javascript
  // Fechamento: consultar conteúdo de requests ABAP
  if (url.pathname === '/api/fechamento/request-content' && req.method === 'GET') {
    const tipo     = url.searchParams.get('tipo') || '';
    const reqParam = url.searchParams.get('requests') || '';
    const requests = reqParam.split(',').map(r => r.trim()).filter(Boolean);

    if (!tipo || requests.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parâmetros tipo e requests são obrigatórios' }));
      return;
    }

    try {
      // TODO: substituir pela chamada RFC real quando disponível
      // Exemplo: const result = await client.call('RFC_GET_REQUEST_CONTENT', { TIPO: tipo, REQUESTS: requests });
      const mockData = requests.map(function(numero) {
        return {
          numero: numero,
          objetos: [
            { tipo: 'PROG', nome: 'Z_PROG_' + numero.slice(-5) },
            { tipo: 'TABL', nome: 'ZT_' + numero.slice(-5) }
          ]
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tipo: tipo, requests: mockData }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  // Fechamento: consolidar requests ABAP em uma única
  if (url.pathname === '/api/fechamento/consolidar' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { tipo, requests } = JSON.parse(body);
        if (!tipo || !Array.isArray(requests) || requests.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Parâmetros tipo e requests são obrigatórios' }));
        }
        // TODO: substituir pela chamada RFC real quando disponível
        // Exemplo: const result = await client.call('RFC_CONSOLIDATE_REQUESTS', { TIPO: tipo, REQUESTS: requests });
        const novaRequest = 'DEV' + Date.now().toString().slice(-9);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          novaRequest: novaRequest,
          tipo: tipo,
          requestsAgrupadas: requests
        }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
      }
    });
    return;
  }

```

- [ ] **Step 4: Testar endpoints**

Iniciar o servidor:
```bash
node /c/vscode/sap-mcp-server/api-server.js
```

Testar no browser:
```
http://localhost:3001/fechamento
http://localhost:3001/api/fechamento/request-content?tipo=WS&requests=DEV001,DEV002
```

Primeiro deve retornar o `fechamento.html`. Segundo deve retornar:
```json
{"success":true,"tipo":"WS","requests":[{"numero":"DEV001","objetos":[...]},{"numero":"DEV002","objetos":[...]}]}
```

- [ ] **Step 5: Commit no sap-mcp-server**

```bash
cd /c/vscode/sap-mcp-server
git add api-server.js
git commit -m "feat: rota /fechamento e endpoints RFC mock para consolidação de requests"
```

---

### Task 6: Teste end-to-end e commit final

**Files:**
- Verify: `C:\vscode\fechamento\fechamento.html` (gerado)

- [ ] **Step 1: Gerar HTML final**

```bash
cd /c/vscode/fechamento && node fechamento.js
```

Esperado: `fechamento.html` gerado sem erros.

- [ ] **Step 2: Iniciar servidor e abrir aplicação**

```bash
node /c/vscode/sap-mcp-server/api-server.js
```

Abrir `http://localhost:3001/fechamento` no browser.

- [ ] **Step 3: Verificar fluxo completo**

1. Tela exibe lista de iterações ADO com header "📦 Fechamento ABAP"
2. Clicar em uma iteração → modal de work items abre com coluna "Requests"
3. Clicar "📦 Requests" em um work item → modal "Requests ABAP" abre e busca comentários ADO
4. Se comentários tiverem padrão `WS\nDEVXXXX` etc → cards por tipo aparecem
5. Clicar "🔍 Ver Conteúdo" → tabela de objetos da request aparece (mock)
6. Botão "✅ Consolidar" fica ativo → clicar → "Consolidação concluída! Nova request: DEV..."
7. Clicar ✕ numa request → ela some da lista
8. Verificar que "Verificar" (análise SAP/IA) ainda funciona normalmente

- [ ] **Step 4: Verificar que `ado` não foi afetado**

Abrir `http://localhost:3001` → deve mostrar o `iteracoes_ado.html` original sem alterações.

- [ ] **Step 5: Commit final do fechamento**

```bash
cd /c/vscode/fechamento
git add fechamento.js fechamento.html
git commit -m "feat: fechamento ABAP completo — geração, parser, painel e RFC endpoints"
```

- [ ] **Step 6: Commit no repositório ado (spec + plan)**

```bash
cd /c/vscode/ado
git add docs/superpowers/plans/2026-04-16-fechamento.md
git commit -m "feat: adiciona plano de implementação do projeto fechamento"
git push
```
