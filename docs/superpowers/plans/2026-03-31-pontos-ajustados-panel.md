# Painel Pontos Ajustados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando a RFC `Z_IN_PGM` retornar números ADO nos campos `O_FONTEFF`, `O_FONTEFS` ou `O_FONTEFM`, exibir um painel lateral direito no modal de Análise IA com cards dos work items referenciados.

**Architecture:** Todas as alterações são no template HTML gerado pela função `gerarHTML()` em `busca_ado.js`. Adiciona CSS para layout 2 colunas no modal, e JS para detectar os campos da RFC, buscar os work items ADO e renderizar os cards. O `api-server.js` não é alterado.

**Tech Stack:** JavaScript (vanilla), HTML/CSS inline no template, ADO REST API v7.0

---

### Task 1: Adicionar CSS para layout 2 colunas no modal

**Files:**
- Modify: `C:/vscode/ado/busca_ado.js` — bloco `<style>` dentro da função `gerarHTML()`

- [ ] **Step 1: Adicionar CSS do layout 2 colunas**

Localizar no arquivo `busca_ado.js` o trecho:
```css
        .detail-table td:first-child { font-weight: 600; width: 130px; color: #495057; }
    </style>
```

Substituir por:
```css
        .detail-table td:first-child { font-weight: 600; width: 130px; color: #495057; }

        /* Layout 2 colunas no modal de análise */
        .analise-2col {
            display: flex;
            gap: 0;
            min-height: 200px;
        }

        .analise-col-left {
            flex: 1 1 55%;
            min-width: 0;
            padding-right: 12px;
            border-right: 1px solid #dee2e6;
        }

        .analise-col-right {
            flex: 0 0 42%;
            min-width: 220px;
            padding-left: 12px;
        }

        .col-right-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6c757d;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            padding-bottom: 4px;
            border-bottom: 1px solid #dee2e6;
        }

        .ref-card {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-left: 3px solid #1e4d8c;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 8px;
            font-size: 12px;
        }

        .ref-card-label {
            font-size: 10px;
            font-weight: 700;
            color: #6c757d;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .ref-card-title {
            font-weight: 600;
            color: #1a3a5c;
            margin-bottom: 6px;
            line-height: 1.3;
        }

        .ref-card table {
            width: 100%;
            font-size: 11px;
            border-collapse: collapse;
            background: transparent;
        }

        .ref-card td {
            padding: 2px 4px;
            border: none;
            vertical-align: top;
        }

        .ref-card td:first-child {
            color: #6c757d;
            font-weight: 600;
            width: 90px;
            white-space: nowrap;
        }

        .ref-card-link {
            display: inline-block;
            margin-top: 6px;
            font-size: 11px;
            color: #1e4d8c;
            text-decoration: none;
        }

        .ref-card-link:hover { text-decoration: underline; }

        .ref-card-loading { color: #6c757d; font-style: italic; font-size: 11px; }

        .ref-card-error { color: #dc3545; font-size: 11px; }

        @media (max-width: 768px) {
            .analise-2col { flex-direction: column; }
            .analise-col-left { border-right: none; border-bottom: 1px solid #dee2e6; padding-right: 0; padding-bottom: 12px; margin-bottom: 12px; }
            .analise-col-right { padding-left: 0; flex: 1 1 auto; }
        }
    </style>
```

- [ ] **Step 2: Verificar que o arquivo foi salvo corretamente**

Abrir `busca_ado.js` e confirmar que as classes `.analise-2col`, `.analise-col-left`, `.analise-col-right`, `.ref-card` existem no bloco `<style>`.

---

### Task 2: Adicionar função JS `renderPontosAjustados` no template

**Files:**
- Modify: `C:/vscode/ado/busca_ado.js` — bloco `<script>` dentro da função `gerarHTML()`

- [ ] **Step 1: Adicionar função `renderPontosAjustados`**

Localizar no bloco `<script>` do template a função:
```javascript
        function closeAnaliseModal() {
            document.getElementById('analiseModal').style.display = 'none';
        }
```

Adicionar ANTES dela:
```javascript
        async function renderPontosAjustados(container, sapData, adoToken) {
            var campos = [
                { label: 'O_FONTEFF', value: sapData && sapData.O_FONTEFF },
                { label: 'O_FONTEFS', value: sapData && sapData.O_FONTEFS },
                { label: 'O_FONTEFM', value: sapData && sapData.O_FONTEFM }
            ].filter(function(c) {
                var v = String(c.value || '').trim();
                return v && v !== '0' && v !== '';
            });

            if (campos.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = '';
            container.innerHTML = '<div class="col-right-title">Pontos Ajustados</div>';

            for (var i = 0; i < campos.length; i++) {
                var campo = campos[i];
                var wid = String(campo.value).trim();
                var card = document.createElement('div');
                card.className = 'ref-card';
                card.innerHTML =
                    '<div class="ref-card-label">' + campo.label + ' → #' + wid + '</div>' +
                    '<div class="ref-card-loading">Carregando...</div>';
                container.appendChild(card);

                try {
                    var resp = await fetch(
                        'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + encodeURIComponent(wid) + '?api-version=7.0',
                        { headers: { 'Authorization': 'Basic ' + adoToken } }
                    );
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    var wi = await resp.json();
                    var f = wi.fields || {};
                    var title = f['System.Title'] || '-';
                    var tipo = f['System.WorkItemType'] || '-';
                    var estado = f['System.State'] || '-';
                    var resp2 = (f['System.AssignedTo'] && f['System.AssignedTo'].displayName) || '-';
                    var sprint = f['System.IterationPath'] || '-';
                    var link = (wi._links && wi._links.html && wi._links.html.href) || '#';

                    card.innerHTML =
                        '<div class="ref-card-label">' + campo.label + ' → #' + wid + '</div>' +
                        '<div class="ref-card-title">' + title + '</div>' +
                        '<table><tbody>' +
                        '<tr><td>Tipo</td><td>' + tipo + '</td></tr>' +
                        '<tr><td>Estado</td><td>' + estado + '</td></tr>' +
                        '<tr><td>Responsável</td><td>' + resp2 + '</td></tr>' +
                        '<tr><td>Sprint</td><td>' + sprint.replace(/^[^\\\\]*\\\\/, '') + '</td></tr>' +
                        '</tbody></table>' +
                        '<a href="' + link + '" target="_blank" class="ref-card-link">Ver no Azure ↗</a>';
                } catch (e) {
                    card.innerHTML =
                        '<div class="ref-card-label">' + campo.label + ' → #' + wid + '</div>' +
                        '<div class="ref-card-error">Erro ao carregar: ' + e.message + '</div>';
                }
            }
        }

```

- [ ] **Step 2: Verificar que a função foi adicionada corretamente**

Confirmar que `renderPontosAjustados` aparece no bloco `<script>` antes de `closeAnaliseModal`.

---

### Task 3: Modificar `analisarWorkItem` para layout 2 colunas

**Files:**
- Modify: `C:/vscode/ado/busca_ado.js` — função `analisarWorkItem` no bloco `<script>`

- [ ] **Step 1: Alterar estrutura inicial do modal**

Localizar dentro da função `analisarWorkItem`:
```javascript
            content.innerHTML = '<div class="loading">⏳ Buscando dados do Azure DevOps...</div>';
            modal.style.display = 'block';
```

Substituir por:
```javascript
            content.innerHTML =
                '<div class="analise-2col">' +
                    '<div class="analise-col-left" id="analiseColLeft"><div class="loading">⏳ Buscando dados do Azure DevOps...</div></div>' +
                    '<div class="analise-col-right" id="analiseColRight" style="display:none"></div>' +
                '</div>';
            modal.style.display = 'block';
```

- [ ] **Step 2: Atualizar todos os `content.innerHTML = ...` intermediários para usar a coluna esquerda**

Localizar as linhas que atualizam `content.innerHTML` com mensagens de loading durante o fluxo SAP/IA:

```javascript
                content.innerHTML = allHtml + '<div class="loading">⏳ Consultando SAP — ' + zsafe + ' (' + (i+1) + '/' + zsafeCodes.length + ')...</div>';
```
```javascript
                    content.innerHTML = allHtml + sapHtml + '<div class="loading">⏳ Analisando com IA — ' + zsafe + '... (pode levar ~30s)</div>';
```

Substituir **ambas** por versões que atualizam apenas a coluna esquerda:
```javascript
                document.getElementById('analiseColLeft').innerHTML = allHtml + '<div class="loading">⏳ Consultando SAP — ' + zsafe + ' (' + (i+1) + '/' + zsafeCodes.length + ')...</div>';
```
```javascript
                    document.getElementById('analiseColLeft').innerHTML = allHtml + sapHtml + '<div class="loading">⏳ Analisando com IA — ' + zsafe + '... (pode levar ~30s)</div>';
```

- [ ] **Step 3: Atualizar o resultado final para usar coluna esquerda e disparar coluna direita**

Localizar a linha final que escreve o resultado no modal:
```javascript
            content.innerHTML = allHtml + adoHtml;
```

Substituir por:
```javascript
            var colLeft = document.getElementById('analiseColLeft');
            var colRight = document.getElementById('analiseColRight');
            if (colLeft) {
                colLeft.innerHTML = allHtml + adoHtml;
            } else {
                content.innerHTML = allHtml + adoHtml;
            }
            // Renderizar painel direito com pontos ajustados
            if (colRight) {
                var sapDataObj = null;
                try { sapDataObj = JSON.parse(sapCode); } catch(_) {}
                await renderPontosAjustados(colRight, sapDataObj, '${token}');
            }
```

- [ ] **Step 4: Atualizar o bloco de exibição do formulário manual de ZSAFE para usar coluna esquerda**

Localizar o trecho que renderiza o formulário quando não há ZSAFE encontrado:
```javascript
                content.innerHTML =
                    '<div class="error" style="margin-bottom:12px">⚠️ Nenhum processo encontrado nos comentários do Work Item.<br>Esperado: comentário com "Processo: ZSAFE..."</div>' +
```

Substituir o `content.innerHTML =` por:
```javascript
                var targetEl = document.getElementById('analiseColLeft') || content;
                targetEl.innerHTML =
                    '<div class="error" style="margin-bottom:12px">⚠️ Nenhum processo encontrado nos comentários do Work Item.<br>Esperado: comentário com "Processo: ZSAFE..."</div>' +
```

E remover o `+ adoHtml;` final desse bloco, substituindo por:
```javascript
                    + adoHtml;
```
(mantém igual — apenas a variável de destino muda)

---

### Task 4: Regenerar HTML e validar

**Files:**
- Execute: `node -e "..."` em `C:/vscode/ado`

- [ ] **Step 1: Regenerar o HTML**

```bash
cd C:/vscode/ado && node -e "
const { buscaIteracoesADO, gerarHTML, salvarHTML } = require('./busca_ado.js');
buscaIteracoesADO().then(dados => {
    const html = gerarHTML(dados);
    salvarHTML(html);
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"
```

Saída esperada:
```
✅ Arquivo HTML gerado: iteracoes_ado.html
```

- [ ] **Step 2: Verificar classes CSS no HTML gerado**

```bash
grep -c "analise-2col\|analise-col-left\|analise-col-right\|ref-card" C:/vscode/ado/iteracoes_ado.html
```

Saída esperada: número > 0 (confirma que as classes foram embutidas no HTML).

- [ ] **Step 3: Verificar função JS no HTML gerado**

```bash
grep -c "renderPontosAjustados" C:/vscode/ado/iteracoes_ado.html
```

Saída esperada: `2` (definição + chamada).

- [ ] **Step 4: Abrir no browser e testar**

```bash
start C:/vscode/ado/iteracoes_ado.html
```

Abrir um work item com ZSAFE nos comentários e clicar em "🤖 ANÁLISE IA". Verificar:
- Modal abre com estrutura 2 colunas quando RFC retorna `O_FONTEFF/S/M` preenchidos
- Cards carregam com título, tipo, estado, responsável, sprint e link
- Quando campos RFC estão vazios, coluna direita não aparece

---

### Task 5: Commit

- [ ] **Step 1: Commitar as alterações**

```bash
cd C:/vscode/ado && git add busca_ado.js docs/superpowers/specs/2026-03-31-pontos-ajustados-panel-design.md docs/superpowers/plans/2026-03-31-pontos-ajustados-panel.md && git commit -m "feat: painel pontos ajustados no modal de análise IA

Quando RFC Z_IN_PGM retorna números ADO em O_FONTEFF, O_FONTEFS ou
O_FONTEFM, exibe painel lateral direito no modal com cards dos
work items referenciados (título, tipo, estado, responsável, sprint)."
```
