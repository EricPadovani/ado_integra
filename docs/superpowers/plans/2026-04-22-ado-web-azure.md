# ADO Web App — Azure App Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o projeto `ado` em uma aplicação web hospedada no Azure App Service, onde colegas acessam iterações do Azure DevOps via navegador sem instalar nada.

**Architecture:** Um servidor Express (`server.js`) serve o frontend (`public/index.html`) e expõe dois endpoints: `GET /api/iteracoes` busca iterações server-side usando o `ADO_TOKEN` do ambiente, e `POST /api/proxy` encaminha chamadas do frontend à API do Azure DevOps — nunca expondo o token ao cliente. O `busca_ado.js` já exporta `buscaIteracoesADO`; criamos `ado-client.js` como wrapper limpo usando fetch nativo (Node 18+).

**Tech Stack:** Node 18, Express 5, node:test (testes), GitHub Actions, Azure App Service

---

## Mapeamento de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `ado-client.js` | Criar | Módulo que busca iterações do ADO via fetch nativo |
| `server.js` | Criar | Express: serve HTML + rotas /api/iteracoes e /api/proxy |
| `public/index.html` | Criar | Frontend: extrai HTML do gerarHTML(), usa adoProxy() |
| `tests/ado-client.test.js` | Criar | Testa buscaIteracoesADO com fetch mockado |
| `tests/server.test.js` | Criar | Testa rotas do Express com supertest |
| `package.json` | Modificar | Adicionar express, supertest, scripts start e test |
| `.gitignore` | Modificar | Adicionar .env |
| `.env.example` | Criar | Template de variáveis de ambiente |
| `.github/workflows/azure-deploy.yml` | Criar | CI/CD para Azure App Service |

---

## Task 1: Atualizar package.json e instalar dependências

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Escrever o teste que valida o script start**

```javascript
// tests/package.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');

test('package.json tem script start', () => {
    assert.ok(pkg.scripts.start, 'script start ausente');
    assert.match(pkg.scripts.start, /server\.js/, 'start deve rodar server.js');
});

test('package.json tem express como dependência', () => {
    assert.ok(pkg.dependencies.express, 'express ausente em dependencies');
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd /c/vscode/ado
node --test tests/package.test.js
```
Expected: FAIL — "script start ausente" e "express ausente"

- [ ] **Step 3: Atualizar package.json**

Substituir o conteúdo de `package.json` por:
```json
{
  "name": "ado",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "dotenv": "^17.3.1",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 4: Instalar dependências**

```bash
cd /c/vscode/ado
npm install
```
Expected: `node_modules/express` e `node_modules/supertest` criados

- [ ] **Step 5: Rodar o teste para confirmar que passa**

```bash
node --test tests/package.test.js
```
Expected: PASS — 2 passing

- [ ] **Step 6: Commit**

```bash
git -C /c/vscode/ado add package.json package-lock.json
git -C /c/vscode/ado commit -m "chore: add express and supertest dependencies"
```

---

## Task 2: Criar ado-client.js

**Files:**
- Create: `ado-client.js`
- Create: `tests/ado-client.test.js`

- [ ] **Step 1: Escrever o teste com fetch mockado**

```javascript
// tests/ado-client.test.js
const { test, mock } = require('node:test');
const assert = require('node:assert');

const MOCK_DATA = {
    count: 2,
    value: [
        { id: 'id-1', name: 'Sprint 1', path: 'Mastersaf Interfaces\\Sprint 1', url: 'https://dev.azure.com/...', attributes: { startDate: '2024-01-01', finishDate: '2024-01-14', timeFrame: 'past' } },
        { id: 'id-2', name: 'Sprint 2', path: 'Mastersaf Interfaces\\Sprint 2', url: 'https://dev.azure.com/...', attributes: { startDate: '2024-01-15', finishDate: '2024-01-28', timeFrame: 'current' } }
    ]
};

test('buscaIteracoesADO retorna dados estruturados', async (t) => {
    const saved = global.fetch;
    global.fetch = async (url, opts) => {
        assert.ok(url.includes('dev.azure.com'), 'deve chamar dev.azure.com');
        assert.ok(opts.headers.Authorization.startsWith('Basic '), 'deve ter header Basic');
        return { ok: true, json: async () => MOCK_DATA };
    };

    process.env.ADO_TOKEN = 'dGVzdA==';
    // Clear module cache para garantir que usa o token do env atual
    delete require.cache[require.resolve('../ado-client')];
    const { buscaIteracoesADO } = require('../ado-client');

    const result = await buscaIteracoesADO();
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.value[0].name, 'Sprint 1');

    global.fetch = saved;
});

test('buscaIteracoesADO lança erro se ADO responde não-ok', async (t) => {
    const saved = global.fetch;
    global.fetch = async () => ({ ok: false, status: 401 });

    delete require.cache[require.resolve('../ado-client')];
    const { buscaIteracoesADO } = require('../ado-client');

    await assert.rejects(buscaIteracoesADO, /401/);

    global.fetch = saved;
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd /c/vscode/ado
node --test tests/ado-client.test.js
```
Expected: FAIL — "Cannot find module '../ado-client'"

- [ ] **Step 3: Criar ado-client.js**

```javascript
// ado-client.js
require('dotenv').config();

const ADO_URL = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/work/teamsettings/iterations?api-version=7.0';

async function buscaIteracoesADO() {
    const response = await fetch(ADO_URL, {
        headers: {
            'Authorization': `Basic ${process.env.ADO_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`ADO API error: ${response.status}`);
    return response.json();
}

module.exports = { buscaIteracoesADO };
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
node --test tests/ado-client.test.js
```
Expected: PASS — 2 passing

- [ ] **Step 5: Commit**

```bash
git -C /c/vscode/ado add ado-client.js tests/ado-client.test.js
git -C /c/vscode/ado commit -m "feat: add ado-client module with native fetch"
```

---

## Task 3: Criar server.js

**Files:**
- Create: `server.js`
- Create: `tests/server.test.js`

- [ ] **Step 1: Escrever testes do servidor**

```javascript
// tests/server.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Mock ado-client antes de carregar o app
const MOCK_ITERACOES = { count: 1, value: [{ id: 'id-1', name: 'Sprint 1' }] };

test('GET / retorna HTML', async () => {
    // Precisa de public/index.html existir — pula se não existir ainda
    const fs = require('fs');
    if (!fs.existsSync('./public/index.html')) {
        console.log('    SKIP: public/index.html ainda não criado (Task 4)');
        return;
    }
    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
});

test('GET /api/iteracoes retorna JSON das iterações', async (t) => {
    const saved = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => MOCK_ITERACOES });
    process.env.ADO_TOKEN = 'dGVzdA==';

    delete require.cache[require.resolve('../ado-client')];
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    const res = await request(app).get('/api/iteracoes');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.value[0].name, 'Sprint 1');

    global.fetch = saved;
});

test('POST /api/proxy encaminha para ADO', async () => {
    const saved = global.fetch;
    global.fetch = async (url, opts) => {
        assert.ok(url.startsWith('https://dev.azure.com/tr-ggo/'), 'URL deve ser do ADO');
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    process.env.ADO_TOKEN = 'dGVzdA==';

    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    const res = await request(app)
        .post('/api/proxy')
        .send({ url: 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/classificationnodes/areas?api-version=7.0', method: 'GET' });

    assert.strictEqual(res.status, 200);
    global.fetch = saved;
});

test('POST /api/proxy recusa URLs fora do ADO', async () => {
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    const res = await request(app)
        .post('/api/proxy')
        .send({ url: 'https://evil.com/steal', method: 'GET' });

    assert.strictEqual(res.status, 403);
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd /c/vscode/ado
node --test tests/server.test.js
```
Expected: FAIL — "Cannot find module '../server'"

- [ ] **Step 3: Criar server.js**

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { buscaIteracoesADO } = require('./ado-client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADO_ALLOWED_PREFIX = 'https://dev.azure.com/tr-ggo/';

app.get('/api/iteracoes', async (req, res) => {
    try {
        const data = await buscaIteracoesADO();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/proxy', async (req, res) => {
    const { url, method = 'GET', body } = req.body || {};
    if (!url || !url.startsWith(ADO_ALLOWED_PREFIX)) {
        return res.status(403).json({ error: 'URL não permitida' });
    }
    try {
        const opts = {
            method,
            headers: {
                'Authorization': `Basic ${process.env.ADO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const response = await fetch(url, opts);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
node --test tests/server.test.js
```
Expected: PASS — 3 passing (o teste de GET / é SKIP até a Task 4)

- [ ] **Step 5: Commit**

```bash
git -C /c/vscode/ado add server.js tests/server.test.js
git -C /c/vscode/ado commit -m "feat: add express server with /api/iteracoes and /api/proxy routes"
```

---

## Task 4: Criar public/index.html

O HTML é extraído do `gerarHTML()` de `busca_ado.js`. A principal mudança é que os dados de iterações são carregados dinamicamente via `fetch('/api/iteracoes')` e todas as chamadas à API do ADO passam pelo helper `adoProxy()`.

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Criar a pasta public**

```bash
mkdir -p /c/vscode/ado/public
```

- [ ] **Step 2: Criar public/index.html**

Criar o arquivo `public/index.html` com o seguinte conteúdo (CSS extraído de `busca_ado.js:101-416`, estrutura HTML de `busca_ado.js:418-532`, JavaScript refatorado para usar `adoProxy()`):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iterações Azure DevOps</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0d2137; min-height: 100vh; padding: 10px; font-size: 13px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1e4d8c 0%, #1a3a5c 100%); color: white; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .header-title { font-size: 1em; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap; }
        .header-stats { display: flex; gap: 6px; flex-wrap: wrap; }
        .stat-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 4px; padding: 3px 10px; font-size: 12px; white-space: nowrap; }
        .stat-badge strong { font-weight: 700; }
        .filters { padding: 6px 16px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; align-items: center; gap: 6px; }
        .filter-btn { padding: 3px 10px; border: 1px solid #ced4da; border-radius: 4px; cursor: pointer; font-size: 12px; background: white; color: #495057; transition: all 0.2s ease; }
        .filter-btn.active { background: #1e4d8c; color: white; border-color: #1e4d8c; }
        .filter-btn:hover:not(.active) { background: #e9ecef; }
        .table-container { overflow-x: auto; padding: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; background: white; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background: #374151; font-weight: 600; color: #ffffff; font-size: 12px; position: sticky; top: 0; z-index: 10; }
        tr:nth-child(even) { background: #f8f9fa; }
        tr:hover { background: #dbeafe; }
        .status-past { background: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; }
        .status-current { background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; }
        .status-future { background: #d1ecf1; color: #0c5460; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; }
        .iteration-link { color: #1e4d8c; text-decoration: none; font-size: 12px; }
        .iteration-link:hover { text-decoration: underline; }
        .path-link { color: #1e4d8c; text-decoration: none; cursor: pointer; }
        .path-link:hover { text-decoration: underline; }
        .footer { background: #f8f9fa; border-top: 1px solid #dee2e6; color: #6c757d; text-align: right; padding: 4px 16px; font-size: 11px; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
        .modal-content { background-color: #f4f6f8; color: #374151; margin: 4% auto; padding: 0; border-radius: 6px; width: 90%; max-width: 1300px; max-height: 85vh; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
        .modal-header { background: linear-gradient(135deg, #1e4d8c 0%, #1a3a5c 100%); color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { margin: 0; font-size: 1em; }
        .close { color: white; font-size: 20px; font-weight: bold; cursor: pointer; line-height: 1; opacity: 0.8; }
        .close:hover { opacity: 1; }
        .modal-body { padding: 12px 16px; max-height: calc(85vh - 46px); overflow-y: auto; }
        .workitems-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .workitems-table th { background: #374151; color: white; padding: 6px 10px; font-size: 12px; text-align: left; }
        .workitems-table td { padding: 5px 10px; border-bottom: 1px solid #e9ecef; font-size: 12px; }
        .workitems-table tr:nth-child(even) { background: #f8f9fa; }
        .workitem-link { color: #1e4d8c; text-decoration: none; font-size: 12px; }
        .workitem-link:hover { text-decoration: underline; }
        .workitem-id { color: #1e4d8c; text-decoration: none; font-weight: 600; cursor: pointer; }
        .workitem-id:hover { text-decoration: underline; }
        .btn-analise-ia { padding: 3px 8px; background: #1e4d8c; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap; font-weight: 600; }
        .btn-analise-ia:hover { background: #1a3a5c; }
        .loading { text-align: center; padding: 20px; color: #666; }
        .error { background: #fce4e4; border-left: 4px solid #e74c3c; padding: 10px; margin: 8px 0; border-radius: 4px; color: #c0392b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="header-title">🔄 Iterações Azure DevOps — Mastersaf Interfaces</span>
            <div class="header-stats" id="headerStats">
                <span class="stat-badge">Carregando...</span>
            </div>
        </div>

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
                    <button onclick="showNaoAtribuidos()" style="background:#e67e22;color:white;border:none;border-radius:5px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;">Não Atribuídos</button>
                    <button onclick="clearFilter()" style="background:none;border:1px solid #aaa;border-radius:5px;padding:8px 14px;font-size:12px;color:#666;cursor:pointer;">Limpar</button>
                </div>
            </div>
        </div>

        <div id="tableHiddenBanner" style="padding:48px;text-align:center;color:#aaa;font-size:13px;background:#fafafa;border-top:1px dashed #ddd;">
            <span style="font-size:32px;display:block;margin-bottom:10px;">🔍</span>
            Selecione <strong>Area Path</strong> e <strong>Iteration Path</strong> acima e clique em <strong>Filtrar</strong> para ver as iterações.
        </div>

        <div class="filters" id="statusFilters" style="display:none">
            <button class="filter-btn" data-status="all" onclick="filterTable('all', this)">Todas</button>
            <button class="filter-btn" data-status="past" onclick="filterTable('past', this)">Concluídas</button>
            <button class="filter-btn active" data-status="current" onclick="filterTable('current', this)">Atuais</button>
            <button class="filter-btn" data-status="future" onclick="filterTable('future', this)">Futuras</button>
        </div>

        <div class="table-container" id="tableContainer" style="display:none">
            <table id="iterationsTable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Nome da Iteração</th>
                        <th>Caminho</th>
                        <th>Data Início</th>
                        <th>Data Fim</th>
                        <th>Status</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody id="iterationsBody"></tbody>
            </table>
        </div>

        <div class="footer" id="footer"></div>
    </div>

    <!-- Modal Work Items -->
    <div id="workItemsModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Work Items da Iteração</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="userFilterContainer" style="display:none;margin-bottom:8px;">
                    <label for="userFilter" style="font-size:12px;font-weight:600;color:#495057;margin-right:6px;">Filtrar por usuário:</label>
                    <select id="userFilter" onchange="filterByUser(this.value)" style="font-size:12px;padding:3px 8px;border:1px solid #ced4da;border-radius:4px;color:#374151;">
                        <option value="">Todos</option>
                    </select>
                </div>
                <div id="modalContent" class="loading">Carregando work items...</div>
            </div>
        </div>
    </div>

    <script>
        // ==========================================
        // PROXY HELPER — todas as chamadas ADO passam aqui
        // ==========================================
        async function adoProxy(url, method, body) {
            method = method || 'GET';
            const opts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, method: method, body: body || null })
            };
            const resp = await fetch('/api/proxy', opts);
            if (!resp.ok) throw new Error('Erro ADO: ' + resp.status + ' ' + resp.statusText);
            return resp.json();
        }

        // ==========================================
        // DADOS DE ITERAÇÕES — carregados do servidor
        // ==========================================
        let iteracoesData = null;

        function formatarData(dataISO) {
            if (!dataISO) return '-';
            return new Date(dataISO).toLocaleDateString('pt-BR');
        }

        function calcTimeFrame(startISO, finishISO) {
            if (!startISO || !finishISO) return 'future';
            var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            var start = new Date(startISO); start.setHours(0, 0, 0, 0);
            var finish = new Date(finishISO); finish.setHours(0, 0, 0, 0);
            if (finish < hoje) return 'past';
            if (start > hoje) return 'future';
            return 'current';
        }

        function buildTable(iteracoes) {
            iteracoesData = iteracoes;
            var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            var countPast = 0, countCurrent = 0, countFuture = 0;

            var tbody = document.getElementById('iterationsBody');
            tbody.innerHTML = '';

            iteracoes.value.forEach(function(iteracao, index) {
                var timeFrame = calcTimeFrame(iteracao.attributes.startDate, iteracao.attributes.finishDate);
                if (timeFrame === 'past') countPast++;
                else if (timeFrame === 'current') countCurrent++;
                else countFuture++;

                var statusClass = 'status-' + timeFrame;
                var statusText = timeFrame === 'past' ? 'Concluída' : timeFrame === 'current' ? 'Atual' : 'Futura';
                var caminho = iteracao.path.replace('Mastersaf Interfaces\\', '');

                var tr = document.createElement('tr');
                tr.dataset.status = timeFrame;
                tr.dataset.path = caminho;
                if (timeFrame !== 'current') tr.style.display = 'none';

                tr.innerHTML = '<td>' + (index + 1) + '</td>'
                    + '<td>' + iteracao.name + '</td>'
                    + '<td><a href="#" class="path-link" onclick="showWorkItems(\'' + iteracao.id + '\', \'' + iteracao.name.replace(/'/g, "\\'") + '\', selectedAreaPath)">' + caminho + '</a></td>'
                    + '<td>' + formatarData(iteracao.attributes.startDate) + '</td>'
                    + '<td>' + formatarData(iteracao.attributes.finishDate) + '</td>'
                    + '<td><span class="' + statusClass + '">' + statusText + '</span></td>'
                    + '<td><a href="' + iteracao.url + '" target="_blank" class="iteration-link">Ver no Azure</a></td>';

                tbody.appendChild(tr);
            });

            document.getElementById('headerStats').innerHTML =
                '<span class="stat-badge">Total: <strong>' + iteracoes.count + '</strong></span>'
                + '<span class="stat-badge">Concluídas: <strong>' + countPast + '</strong></span>'
                + '<span class="stat-badge">Atual: <strong>' + countCurrent + '</strong></span>'
                + '<span class="stat-badge">Futuras: <strong>' + countFuture + '</strong></span>';

            document.getElementById('footer').textContent = 'Atualizado em ' + new Date().toLocaleString('pt-BR') + ' | Azure DevOps API';
        }

        // ==========================================
        // FILTROS AREA + ITERATION
        // ==========================================
        var selectedAreaPath = '';
        var selectedIterationPath = '';
        var areaTreeData = null;
        var iterationTreeData = null;

        async function initFilters() {
            try {
                var ADO_BASE = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384';
                var results = await Promise.all([
                    adoProxy(ADO_BASE + '/_apis/wit/classificationnodes/areas?$depth=10&api-version=7.0'),
                    adoProxy(ADO_BASE + '/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.0')
                ]);
                areaTreeData = results[0];
                iterationTreeData = results[1];
                var areaRoot = findNodeByName(areaTreeData, 'Mastersaf Interfaces');
                var iterRoot = findNodeByName(iterationTreeData, 'Mastersaf Interfaces');
                if (areaRoot) buildCascade('areaCascade', areaRoot, 'area');
                if (iterRoot) buildCascade('iterationCascade', iterRoot, 'iteration');
            } catch (e) {
                document.getElementById('filterBar').insertAdjacentHTML('beforeend', '<p style="color:red;font-size:12px;margin:6px 0 0">⚠️ Erro ao carregar filtros: ' + e.message + '</p>');
            }
        }

        function findNodeByName(node, name) {
            if (node.name === name) return node;
            if (node.children) {
                for (var i = 0; i < node.children.length; i++) {
                    var found = findNodeByName(node.children[i], name);
                    if (found) return found;
                }
            }
            return null;
        }

        function buildCascade(containerId, parentNode, type) {
            var container = document.getElementById(containerId);
            if (!parentNode || !parentNode.children || parentNode.children.length === 0) return;
            var select = document.createElement('select');
            select.style.cssText = 'border:1px solid #aac4e8;border-radius:5px;padding:6px 10px;font-size:12px;background:white;min-width:130px;cursor:pointer;';
            var defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '-- selecione --';
            select.appendChild(defaultOpt);
            parentNode.children.forEach(function(child) {
                var opt = document.createElement('option');
                opt.value = child.name;
                opt.textContent = child.name;
                select.appendChild(opt);
            });
            select.addEventListener('change', function() {
                var next = select.nextSibling;
                while (next) { var rem = next; next = next.nextSibling; container.removeChild(rem); }
                updateSelectedPath(containerId, type);
                if (select.value) {
                    var childNode = parentNode.children.find(function(c) { return c.name === select.value; });
                    if (childNode && childNode.children && childNode.children.length > 0) {
                        var arrow = document.createElement('span');
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
            var selects = document.getElementById(containerId).querySelectorAll('select');
            var path = Array.from(selects).map(function(s) { return s.value; }).filter(Boolean).join('\\');
            if (type === 'area') selectedAreaPath = path;
            else selectedIterationPath = path;
        }

        function applyFilter() {
            document.getElementById('tableHiddenBanner').style.display = 'none';
            document.getElementById('tableContainer').style.display = '';
            document.getElementById('statusFilters').style.display = '';
            var activeBtn = document.querySelector('.filter-btn.active');
            var status = activeBtn ? (activeBtn.dataset.status || 'all') : 'all';
            var rows = document.querySelectorAll('#iterationsTable tbody tr');
            rows.forEach(function(row) {
                var matchesStatus = status === 'all' || row.dataset.status === status;
                var rowPath = row.dataset.path || '';
                var matchesIteration = !selectedIterationPath || rowPath.startsWith(selectedIterationPath);
                row.style.display = (matchesStatus && matchesIteration) ? '' : 'none';
            });
        }

        function clearFilter() {
            selectedAreaPath = '';
            selectedIterationPath = '';
            document.getElementById('areaCascade').innerHTML = '';
            document.getElementById('iterationCascade').innerHTML = '';
            var areaRoot = areaTreeData ? findNodeByName(areaTreeData, 'Mastersaf Interfaces') : null;
            var iterRoot = iterationTreeData ? findNodeByName(iterationTreeData, 'Mastersaf Interfaces') : null;
            if (areaRoot) buildCascade('areaCascade', areaRoot, 'area');
            if (iterRoot) buildCascade('iterationCascade', iterRoot, 'iteration');
            document.getElementById('tableContainer').style.display = 'none';
            document.getElementById('statusFilters').style.display = 'none';
            document.getElementById('tableHiddenBanner').style.display = '';
        }

        function filterTable(status, button) {
            var rows = document.querySelectorAll('#iterationsTable tbody tr');
            document.querySelectorAll('.filter-btn').forEach(function(btn) { btn.classList.remove('active'); });
            button.classList.add('active');
            rows.forEach(function(row) {
                var matchesStatus = status === 'all' || row.dataset.status === status;
                var rowPath = row.dataset.path || '';
                var matchesIteration = !selectedIterationPath || rowPath.startsWith(selectedIterationPath);
                row.style.display = (matchesStatus && matchesIteration) ? '' : 'none';
            });
        }

        // ==========================================
        // WORK ITEMS
        // ==========================================
        async function showWorkItems(iterationId, iterationName, areaPath) {
            var modal = document.getElementById('workItemsModal');
            var modalTitle = document.getElementById('modalTitle');
            var modalContent = document.getElementById('modalContent');
            var userFilterContainer = document.getElementById('userFilterContainer');
            var userFilter = document.getElementById('userFilter');

            modalTitle.textContent = 'Work Items: ' + iterationName;
            modalContent.innerHTML = '<div class="loading">Carregando work items...</div>';
            userFilterContainer.style.display = 'none';
            userFilter.innerHTML = '<option value="">Todos</option>';
            modal.style.display = 'block';

            var ADO_BASE = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384';
            var TEAM_URL = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/949cc173-78b1-4459-be54-be0d7e2ca3f2';

            try {
                var data = await adoProxy(TEAM_URL + '/_apis/work/teamsettings/iterations/' + iterationId + '/workitems?api-version=7.0');

                if (!data.workItemRelations || data.workItemRelations.length === 0) {
                    modalContent.innerHTML = '<p><strong>Nenhum work item encontrado nesta iteração.</strong></p>';
                    return;
                }

                var html = '<p><strong>Filtrando User Stories...</strong></p><table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th></tr></thead><tbody>';
                var userStoryCount = 0;
                var usersSet = new Set();

                for (var rel of data.workItemRelations) {
                    try {
                        var wi = await adoProxy(ADO_BASE + '/_apis/wit/workitems/' + rel.target.id + '?api-version=7.0');
                        var f = wi.fields;
                        if (f['System.WorkItemType'] !== 'User Story') continue;
                        if (areaPath) {
                            var fullArea = ('Mastersaf Interfaces\\' + areaPath).normalize('NFC');
                            var itemArea = (f['System.AreaPath'] || '').normalize('NFC');
                            if (itemArea !== fullArea && !itemArea.startsWith(fullArea + '\\')) continue;
                        }
                        userStoryCount++;
                        var assignee = (f['System.AssignedTo'] && f['System.AssignedTo'].displayName) || '-';
                        if (assignee !== '-') usersSet.add(assignee);
                        html += '<tr data-user="' + assignee.replace(/"/g, '&quot;') + '">'
                            + '<td>' + wi.id + '</td>'
                            + '<td>' + (f['System.WorkItemType'] || 'N/A') + '</td>'
                            + '<td>' + (f['System.Title'] || 'N/A') + '</td>'
                            + '<td>' + (f['System.State'] || 'N/A') + '</td>'
                            + '<td>' + assignee + '</td>'
                            + '<td><a href="' + wi._links.html.href + '" target="_blank" class="workitem-link">Ver no Azure</a></td>'
                            + '</tr>';
                    } catch (e) { /* item com erro — ignora */ }
                }

                html += '</tbody></table>';
                modalContent.innerHTML = '<p><strong>User Stories: ' + userStoryCount + '</strong></p>' + html.replace('<p><strong>Filtrando User Stories...</strong></p>', '');

                if (usersSet.size > 0) {
                    usersSet.forEach(function(u) {
                        var opt = document.createElement('option');
                        opt.value = u; opt.textContent = u;
                        userFilter.appendChild(opt);
                    });
                    userFilterContainer.style.display = 'block';
                }
            } catch (e) {
                modalContent.innerHTML = '<div class="error">Erro ao carregar work items: ' + e.message + '</div>';
            }
        }

        async function showNaoAtribuidos() {
            if (!selectedIterationPath) {
                alert('Selecione um Iteration Path para buscar itens não atribuídos.');
                return;
            }
            var modal = document.getElementById('workItemsModal');
            var modalTitle = document.getElementById('modalTitle');
            var modalContent = document.getElementById('modalContent');
            var userFilterContainer = document.getElementById('userFilterContainer');
            var userFilter = document.getElementById('userFilter');

            var ADO_BASE = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384';
            var fullIterPath = 'Mastersaf Interfaces\\' + selectedIterationPath;
            var areaClause = selectedAreaPath
                ? "[System.AreaPath] UNDER 'Mastersaf Interfaces\\" + selectedAreaPath + "'"
                : "[System.AreaPath] UNDER 'Mastersaf Interfaces'";

            modalTitle.textContent = 'Não Atribuídos a Sprint: ' + selectedIterationPath;
            modalContent.innerHTML = '<div class="loading">Buscando work items sem sprint atribuída...</div>';
            userFilterContainer.style.display = 'none';
            userFilter.innerHTML = '<option value="">Todos</option>';
            modal.style.display = 'block';

            var wiql = { query: "SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '" + fullIterPath + "' AND " + areaClause + " ORDER BY [System.ChangedDate] DESC" };

            try {
                var data = await adoProxy(ADO_BASE + '/_apis/wit/wiql?api-version=7.0', 'POST', wiql);
                if (!data.workItems || data.workItems.length === 0) {
                    modalContent.innerHTML = '<p><strong>Nenhum work item encontrado sem sprint atribuída neste caminho.</strong></p>';
                    return;
                }

                var html = '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th></tr></thead><tbody>';
                var usersSet = new Set();
                var count = 0;

                for (var item of data.workItems) {
                    try {
                        var wi = await adoProxy(ADO_BASE + '/_apis/wit/workitems/' + item.id + '?api-version=7.0');
                        var f = wi.fields;
                        count++;
                        var assignee = (f['System.AssignedTo'] && f['System.AssignedTo'].displayName) || '-';
                        if (assignee !== '-') usersSet.add(assignee);
                        html += '<tr data-user="' + assignee.replace(/"/g, '&quot;') + '">'
                            + '<td>' + wi.id + '</td>'
                            + '<td>' + (f['System.WorkItemType'] || 'N/A') + '</td>'
                            + '<td>' + (f['System.Title'] || 'N/A') + '</td>'
                            + '<td>' + (f['System.State'] || 'N/A') + '</td>'
                            + '<td>' + assignee + '</td>'
                            + '<td><a href="' + wi._links.html.href + '" target="_blank" class="workitem-link">Ver no Azure</a></td>'
                            + '</tr>';
                    } catch (e) { /* item com erro — ignora */ }
                }

                html += '</tbody></table>';
                modalContent.innerHTML = '<p><strong>' + count + ' item(s) encontrado(s)</strong></p>' + html;

                if (usersSet.size > 0) {
                    usersSet.forEach(function(u) {
                        var opt = document.createElement('option');
                        opt.value = u; opt.textContent = u;
                        userFilter.appendChild(opt);
                    });
                    userFilterContainer.style.display = 'block';
                }
            } catch (e) {
                modalContent.innerHTML = '<div class="error">Erro ao buscar itens: ' + e.message + '</div>';
            }
        }

        function closeModal() {
            document.getElementById('workItemsModal').style.display = 'none';
        }

        function filterByUser(user) {
            document.querySelectorAll('#modalContent .workitems-table tbody tr').forEach(function(row) {
                row.style.display = (!user || row.dataset.user === user) ? '' : 'none';
            });
        }

        // ==========================================
        // INICIALIZAÇÃO
        // ==========================================
        document.addEventListener('DOMContentLoaded', async function() {
            document.getElementById('tableContainer').style.display = 'none';
            document.getElementById('statusFilters').style.display = 'none';

            try {
                var resp = await fetch('/api/iteracoes');
                if (!resp.ok) throw new Error('Erro ao carregar iterações: ' + resp.status);
                var data = await resp.json();
                buildTable(data);
                initFilters();
            } catch (e) {
                document.getElementById('headerStats').innerHTML = '<span class="stat-badge" style="background:rgba(220,53,69,0.3)">Erro ao carregar dados</span>';
                document.getElementById('tableHiddenBanner').innerHTML = '<span style="font-size:32px;display:block;margin-bottom:10px;">❌</span><strong>Erro:</strong> ' + e.message;
            }
        });
    </script>
</body>
</html>
```

- [ ] **Step 3: Rodar o teste de GET / (que estava sendo SKIP)**

```bash
cd /c/vscode/ado
node --test tests/server.test.js
```
Expected: PASS — agora todos os 4 testes passam (incluindo GET /)

- [ ] **Step 4: Testar manualmente o servidor**

```bash
cd /c/vscode/ado
# Criar .env temporário para teste
echo "ADO_TOKEN=seu_token_aqui" > .env
node server.js
```
Abrir `http://localhost:3000` no navegador e verificar que:
- A página carrega com header "Iterações Azure DevOps"
- Os filtros de Area Path e Iteration Path aparecem
- Ao filtrar, a tabela de iterações é exibida

- [ ] **Step 5: Commit**

```bash
git -C /c/vscode/ado add public/index.html
git -C /c/vscode/ado commit -m "feat: add frontend with adoProxy helper replacing direct ADO calls"
```

---

## Task 5: Configurar .gitignore e .env.example

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Verificar se .gitignore existe**

```bash
cat /c/vscode/ado/.gitignore 2>/dev/null || echo "Não existe"
```

- [ ] **Step 2: Atualizar (ou criar) .gitignore**

```bash
cat > /c/vscode/ado/.gitignore << 'EOF'
node_modules/
.env
*.log
EOF
```

- [ ] **Step 3: Criar .env.example**

```bash
cat > /c/vscode/ado/.env.example << 'EOF'
# Token do Azure DevOps — encode em Base64: echo -n ":SEU_PAT" | base64
ADO_TOKEN=

# Porta local (opcional, padrão 3000)
PORT=3000
EOF
```

- [ ] **Step 4: Commit**

```bash
git -C /c/vscode/ado add .gitignore .env.example
git -C /c/vscode/ado commit -m "chore: add .gitignore and .env.example"
```

---

## Task 6: Criar GitHub Actions — deploy automático para Azure

**Files:**
- Create: `.github/workflows/azure-deploy.yml`

> **Pré-requisito:** Ter criado o Azure App Service e obtido o Publish Profile (ver Task 7).

- [ ] **Step 1: Criar diretório e arquivo de workflow**

```bash
mkdir -p /c/vscode/ado/.github/workflows
```

- [ ] **Step 2: Criar .github/workflows/azure-deploy.yml**

```yaml
name: Deploy ADO Web App to Azure

on:
  push:
    branches:
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Instalar dependências
        run: npm install --production

      - name: Rodar testes
        run: npm test

      - name: Deploy para Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: .
```

- [ ] **Step 3: Commit**

```bash
git -C /c/vscode/ado add .github/workflows/azure-deploy.yml
git -C /c/vscode/ado commit -m "ci: add GitHub Actions workflow for Azure App Service deploy"
```

---

## Task 7: Configurar Azure App Service e GitHub Secrets

Estas são instruções manuais no portal do Azure e GitHub.

**Parte A — Criar App Service no Azure:**

- [ ] **Step 1: Acessar portal.azure.com → "Aplicativo Web" → "+ Create"**

- [ ] **Step 2: Preencher o formulário:**
  - **Subscription:** selecionar sua subscription
  - **Resource Group:** criar novo ou usar existente
  - **Name:** ex: `ado-mastersaf` (será a URL: `ado-mastersaf.azurewebsites.net`)
  - **Runtime stack:** Node 18 LTS
  - **Operating System:** Linux
  - **Region:** Brazil South (ou mais próximo)
  - **Plan:** Free F1 (para testes) ou B1 Basic

- [ ] **Step 3: Clicar em "Review + create" → "Create"**

**Parte B — Configurar ADO_TOKEN no Azure:**

- [ ] **Step 4: No App Service criado, ir em "Configuration" → "Application settings"**

- [ ] **Step 5: Clicar em "+ New application setting":**
  - **Name:** `ADO_TOKEN`
  - **Value:** valor do token em Base64 (mesmo que está no seu `.env` local)
  - Clicar em "OK" → "Save"

**Parte C — Obter Publish Profile e configurar GitHub:**

- [ ] **Step 6: No App Service → "Overview" → "Get publish profile" → baixar o arquivo `.PublishSettings`**

- [ ] **Step 7: No repositório GitHub → "Settings" → "Secrets and variables" → "Actions" → "New repository secret":**
  - **Name:** `AZURE_PUBLISH_PROFILE`
  - **Value:** colar o conteúdo inteiro do arquivo `.PublishSettings`

- [ ] **Step 8: Adicionar segundo secret:**
  - **Name:** `AZURE_WEBAPP_NAME`
  - **Value:** o nome do App Service criado (ex: `ado-mastersaf`)

**Parte D — Verificar deploy:**

- [ ] **Step 9: Fazer git push**

```bash
git -C /c/vscode/ado push origin master
```

- [ ] **Step 10: Acompanhar o deploy no GitHub**

Ir em GitHub → repositório → "Actions" → ver o workflow rodando.
Expected: todos os steps verdes, deploy bem-sucedido.

- [ ] **Step 11: Acessar a URL do App Service**

Abrir `https://NOME-DO-APP.azurewebsites.net` no navegador.
Expected: página de iterações carrega, filtros funcionam.

---

## Resumo dos comandos de teste

```bash
# Rodar todos os testes
cd /c/vscode/ado && npm test

# Rodar servidor local
cd /c/vscode/ado && node server.js

# Verificar variável ADO_TOKEN (deve estar no .env local)
cd /c/vscode/ado && node -e "require('dotenv').config(); console.log('TOKEN:', process.env.ADO_TOKEN ? 'OK' : 'AUSENTE')"
```
