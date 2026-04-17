# Filtro Area Path + Iteration Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar barra de filtro com dropdowns em cascata para Area Path e Iteration Path antes da tabela de iterações em `iteracoes_ado.html`.

**Architecture:** `busca_ado.js` gera o HTML completo via `gerarHTML()` — todas as mudanças de template vão neste arquivo. O HTML gerado faz fetch diretamente para a API do Azure DevOps para carregar as árvores de area/iteration ao abrir a página. A tabela fica oculta até o usuário clicar "Filtrar". Ao regenerar o HTML com `node busca_ado.js`, o `iteracoes_ado.html` é atualizado.

**Tech Stack:** Node.js (gerador HTML), Vanilla JS (client-side), Azure DevOps REST API v7.0

---

## Mapa de arquivos

| Arquivo | O que muda |
|---------|-----------|
| `busca_ado.js` | 5 edições: (1) `data-path` nos `<tr>`, (2) onclick com `selectedAreaPath`, (3) HTML do filtro, (4) `table-container` oculto, (5) JS do filtro + modificar `filterTable` + modificar `showWorkItems` |
| `iteracoes_ado.html` | Regenerado por `node busca_ado.js` — não editar diretamente |

---

## Task 1: Adicionar `data-path` nos `<tr>` gerados

**Arquivo:** `busca_ado.js:460`

- [ ] **Passo 1: Editar a linha do `<tr>`**

Localizar a linha (~460):
```javascript
                    <tr data-status="${timeFrame}"${rowDisplay}>
```

Substituir por:
```javascript
                    <tr data-status="${timeFrame}" data-path="${iteracao.path.replace('Mastersaf Interfaces\\', '')}"${rowDisplay}>
```

- [ ] **Passo 2: Verificar a edição**

```bash
grep -n "data-path" C:/vscode/ado/busca_ado.js
```

Esperado: uma linha com `data-path="\${iteracao.path.replace(...)}"` na linha ~460.

---

## Task 2: Atualizar onclick para passar `selectedAreaPath`

**Arquivo:** `busca_ado.js:463`

- [ ] **Passo 1: Editar o onclick do link de caminho**

Localizar (~linha 463):
```javascript
onclick="showWorkItems('${iteracao.id}', '${iteracao.name}')"
```

Substituir por:
```javascript
onclick="showWorkItems('${iteracao.id}', '${iteracao.name}', selectedAreaPath)"
```

- [ ] **Passo 2: Verificar**

```bash
grep -n "selectedAreaPath" C:/vscode/ado/busca_ado.js
```

Esperado: 1 ocorrência no onclick.

---

## Task 3: Adicionar HTML da barra de filtro e ocultar tabela

**Arquivo:** `busca_ado.js:430` e `:437`

- [ ] **Passo 1: Inserir barra de filtro antes de `<div class="filters">`**

Localizar (~linha 430):
```javascript
        <div class="filters">
```

Inserir ANTES dessa linha:
```javascript
        <div id="filterBar" style="background:#f0f4ff;border-bottom:2px solid #c7d6f5;padding:12px 20px;">
            <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
                <div>
                    <div style="font-size:10px;font-weight:700;color:#1e4d8c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Area Path</div>
                    <div id="areaCascade" style="display:flex;gap:6px;align-items:center;"></div>
                </div>
                <div>
                    <div style="font-size:10px;font-weight:700;color:#1e4d8c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Iteration Path</div>
                    <div id="iterationCascade" style="display:flex;gap:6px;align-items:center;"></div>
                </div>
                <div style="display:flex;gap:6px;padding-bottom:1px;">
                    <button onclick="applyFilter()" style="background:#1e4d8c;color:white;border:none;border-radius:5px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Filtrar</button>
                    <button onclick="clearFilter()" style="background:none;border:1px solid #aaa;border-radius:5px;padding:8px 14px;font-size:12px;color:#666;cursor:pointer;">Limpar</button>
                </div>
            </div>
        </div>
        <div id="tableHiddenBanner" style="padding:48px;text-align:center;color:#aaa;font-size:13px;background:#fafafa;border-top:1px dashed #ddd;">
            <span style="font-size:32px;display:block;margin-bottom:10px;">🔍</span>
            Selecione <strong>Area Path</strong> e <strong>Iteration Path</strong> acima e clique em <strong>Filtrar</strong> para ver as iterações.
        </div>
```

- [ ] **Passo 2: Ocultar `table-container` por padrão**

Localizar (~linha 437, após a inserção acima):
```javascript
        <div class="table-container">
```

Substituir por:
```javascript
        <div class="table-container" style="display:none">
```

- [ ] **Passo 3: Verificar**

```bash
grep -n "filterBar\|tableHiddenBanner\|table-container" C:/vscode/ado/busca_ado.js | head -10
```

Esperado: `filterBar`, `tableHiddenBanner` e `table-container` com `style="display:none"`.

---

## Task 4: Adicionar JS do filtro e modificar `filterTable`

**Arquivo:** `busca_ado.js:513` (início do bloco `<script>`)

- [ ] **Passo 1: Inserir variáveis e funções do filtro logo após `<script>`**

Localizar (~linha 513):
```javascript
    <script>
        function filterTable(status, button) {
```

Substituir por:
```javascript
    <script>
        // === FILTRO AREA + ITERATION ===
        let selectedAreaPath = '';
        let selectedIterationPath = '';
        let areaTreeData = null;
        let iterationTreeData = null;

        const ADO_FILTER_HEADERS = {
            'Authorization': 'Basic ${token}',
            'Content-Type': 'application/json'
        };

        async function initFilters() {
            try {
                const [areasResp, iterResp] = await Promise.all([
                    fetch('https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/classificationnodes/areas?$depth=10&api-version=7.0', { headers: ADO_FILTER_HEADERS }),
                    fetch('https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.0', { headers: ADO_FILTER_HEADERS })
                ]);
                if (!areasResp.ok || !iterResp.ok) throw new Error('Erro ' + areasResp.status);
                areaTreeData = await areasResp.json();
                iterationTreeData = await iterResp.json();
                const areaRoot = findNodeByName(areaTreeData, 'Mastersaf Interfaces');
                const iterRoot = findNodeByName(iterationTreeData, 'Mastersaf Interfaces');
                if (areaRoot) buildCascade('areaCascade', areaRoot, 'area');
                if (iterRoot) buildCascade('iterationCascade', iterRoot, 'iteration');
            } catch (e) {
                document.getElementById('filterBar').insertAdjacentHTML('beforeend', '<p style="color:red;font-size:12px;margin:6px 0 0">⚠️ Erro ao carregar filtros: ' + e.message + '</p>');
            }
        }

        function findNodeByName(node, name) {
            if (node.name === name) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNodeByName(child, name);
                    if (found) return found;
                }
            }
            return null;
        }

        function buildCascade(containerId, parentNode, type) {
            const container = document.getElementById(containerId);
            if (!parentNode || !parentNode.children || parentNode.children.length === 0) return;
            const select = document.createElement('select');
            select.style.cssText = 'border:1px solid #aac4e8;border-radius:5px;padding:6px 10px;font-size:12px;background:white;min-width:130px;cursor:pointer;';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '-- selecione --';
            select.appendChild(defaultOpt);
            parentNode.children.forEach(function(child) {
                const opt = document.createElement('option');
                opt.value = child.name;
                opt.textContent = child.name;
                select.appendChild(opt);
            });
            select.addEventListener('change', function() {
                let next = select.nextSibling;
                while (next) { const rem = next; next = next.nextSibling; container.removeChild(rem); }
                updateSelectedPath(containerId, type);
                if (select.value) {
                    const childNode = parentNode.children.find(function(c) { return c.name === select.value; });
                    if (childNode && childNode.children && childNode.children.length > 0) {
                        const arrow = document.createElement('span');
                        arrow.textContent = '›';
                        arrow.style.cssText = 'color:#999;font-size:14px;padding:0 2px;';
                        container.appendChild(arrow);
                        buildCascade(containerId, childNode, type);
                    }
                }
            });
            container.appendChild(select);
        }

        function updateSelectedPath(containerId, type) {
            const selects = document.getElementById(containerId).querySelectorAll('select');
            const path = Array.from(selects).map(function(s) { return s.value; }).filter(Boolean).join('\\\\');
            if (type === 'area') selectedAreaPath = path;
            else selectedIterationPath = path;
        }

        function applyFilter() {
            document.getElementById('tableHiddenBanner').style.display = 'none';
            document.querySelector('.table-container').style.display = '';
            const activeBtn = document.querySelector('.filter-btn.active');
            const status = activeBtn ? (activeBtn.getAttribute('onclick').match(/'([^']+)'/) || [])[1] || 'all' : 'all';
            const rows = document.querySelectorAll('#iterationsTable tbody tr');
            rows.forEach(function(row) {
                const matchesStatus = status === 'all' || row.dataset.status === status;
                const rowPath = row.dataset.path || '';
                const matchesIteration = !selectedIterationPath || rowPath.startsWith(selectedIterationPath);
                row.style.display = (matchesStatus && matchesIteration) ? '' : 'none';
            });
            updateFilterBadge();
        }

        function clearFilter() {
            selectedAreaPath = '';
            selectedIterationPath = '';
            document.getElementById('areaCascade').innerHTML = '';
            document.getElementById('iterationCascade').innerHTML = '';
            const areaRoot = areaTreeData ? findNodeByName(areaTreeData, 'Mastersaf Interfaces') : null;
            const iterRoot = iterationTreeData ? findNodeByName(iterationTreeData, 'Mastersaf Interfaces') : null;
            if (areaRoot) buildCascade('areaCascade', areaRoot, 'area');
            if (iterRoot) buildCascade('iterationCascade', iterRoot, 'iteration');
            document.querySelector('.table-container').style.display = 'none';
            document.getElementById('tableHiddenBanner').style.display = '';
            updateFilterBadge();
        }

        function updateFilterBadge() {
            let badge = document.getElementById('filterActiveBadge');
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'filterActiveBadge';
                badge.className = 'stat-badge';
                document.querySelector('.header-stats').appendChild(badge);
            }
            if (selectedAreaPath || selectedIterationPath) {
                badge.textContent = (selectedAreaPath || 'Todas as áreas') + ' · ' + (selectedIterationPath || 'Todas as iterações');
                badge.style.display = '';
            } else {
                badge.style.display = 'none';
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            document.querySelector('.table-container').style.display = 'none';
            initFilters();
        });
        // === FIM FILTRO ===

        function filterTable(status, button) {
```

- [ ] **Passo 2: Modificar o corpo de `filterTable` para respeitar `selectedIterationPath`**

Localizar o corpo atual de `filterTable` (~linha 521 após a inserção):
```javascript
            rows.forEach(row => {
                row.style.display = (status === 'all' || row.dataset.status === status) ? '' : 'none';
            });
```

Substituir por:
```javascript
            rows.forEach(row => {
                const matchesStatus = status === 'all' || row.dataset.status === status;
                const rowPath = row.dataset.path || '';
                const matchesIteration = !selectedIterationPath || rowPath.startsWith(selectedIterationPath);
                row.style.display = (matchesStatus && matchesIteration) ? '' : 'none';
            });
```

- [ ] **Passo 3: Verificar**

```bash
grep -n "initFilters\|buildCascade\|applyFilter\|clearFilter\|matchesIteration" C:/vscode/ado/busca_ado.js | head -20
```

Esperado: todas as funções presentes.

---

## Task 5: Modificar `showWorkItems` para filtrar por Area Path

**Arquivo:** `busca_ado.js` — função `showWorkItems` no template

- [ ] **Passo 1: Atualizar a assinatura da função**

Localizar:
```javascript
        async function showWorkItems(iterationId, iterationName) {
```

Substituir por:
```javascript
        async function showWorkItems(iterationId, iterationName, areaPath) {
```

- [ ] **Passo 2: Adicionar filtro de Area Path dentro do loop**

Localizar dentro do loop de work items (~linha com `if (fields['System.WorkItemType'] === 'User Story')`):
```javascript
                                if (fields['System.WorkItemType'] === 'User Story') {
                                    userStoryCount++;
```

Substituir por:
```javascript
                                if (fields['System.WorkItemType'] === 'User Story') {
                                    if (areaPath) {
                                        const fullArea = 'Mastersaf Interfaces\\\\' + areaPath;
                                        const itemArea = fields['System.AreaPath'] || '';
                                        if (itemArea !== fullArea && !itemArea.startsWith(fullArea + '\\\\')) continue;
                                    }
                                    userStoryCount++;
```

- [ ] **Passo 3: Verificar**

```bash
grep -n "areaPath\|System.AreaPath\|fullArea" C:/vscode/ado/busca_ado.js | head -10
```

Esperado: assinatura, filtro e `System.AreaPath` presentes.

---

## Task 6: Regenerar `iteracoes_ado.html` e verificar

- [ ] **Passo 1: Regenerar o HTML**

```bash
cd C:/vscode/ado && node busca_ado.js
```

Esperado: `✅ Arquivo HTML gerado: iteracoes_ado.html`

- [ ] **Passo 2: Verificar elementos no HTML gerado**

```bash
grep -c "data-path=" C:/vscode/ado/iteracoes_ado.html
```

Esperado: número igual ao de iterações (~80).

```bash
grep -n "filterBar\|tableHiddenBanner\|initFilters\|buildCascade\|applyFilter" C:/vscode/ado/iteracoes_ado.html | head -10
```

Esperado: todas as funções presentes no HTML.

```bash
grep -n "showWorkItems.*selectedAreaPath" C:/vscode/ado/iteracoes_ado.html | head -3
```

Esperado: os onclicks passando `selectedAreaPath`.

- [ ] **Passo 3: Commit**

```bash
cd C:/vscode/ado && git add busca_ado.js iteracoes_ado.html && git commit -m "$(cat <<'EOF'
feat: adiciona filtro Area Path + Iteration Path com dropdowns em cascata

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Verificação manual no browser

Após o commit, iniciar a aplicação e verificar:

1. Abrir `http://localhost:3001` — tabela deve estar **oculta**, barra de filtro visível
2. Selecionar um nível no **Area Path** cascade → próximo dropdown aparece
3. Selecionar um nível no **Iteration Path** cascade → próximo dropdown aparece
4. Clicar **Filtrar** → tabela aparece com iterações filtradas pelo path selecionado
5. Clicar nos botões **Todas / Atuais / Futuras** — deve respeitar o filtro de iteration ativo
6. Clicar em um sprint → modal de work items deve mostrar apenas itens da Area selecionada
7. Clicar **Limpar** → dropdowns resetam, tabela volta a ficar oculta
