require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');

const token = process.env.ADO_TOKEN;

async function buscaIteracoesADO() {
    const url = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/work/teamsettings/iterations?api-version=7.0';

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Erro ao buscar iterações:', error.message);
        throw error;
    }
}

function formatarData(dataISO) {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
}

function exibirTabela(iteracoes) {
    console.log('\n=== ITERAÇÕES AZURE DEVOPS ===');
    console.log(`Total: ${iteracoes.count} iterações\n`);

    // Preparar dados para tabela
    const tabela = iteracoes.value.map((iteracao, index) => ({
        '#': index + 1,
        'Nome': iteracao.name,
        'Caminho': iteracao.path.replace('Mastersaf Interfaces\\', ''),
        'Início': formatarData(iteracao.attributes.startDate),
        'Fim': formatarData(iteracao.attributes.finishDate),
        'Período': iteracao.attributes.timeFrame
    }));

    console.table(tabela);
}

async function selecionarIteracao(iteracoes) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('\nDigite o número da iteração para selecionar (ou 0 para sair): ', (resposta) => {
            rl.close();
            const numero = parseInt(resposta);
            if (numero === 0) {
                console.log('Saindo...');
                resolve(null);
            } else if (numero >= 1 && numero <= iteracoes.value.length) {
                const iteracaoSelecionada = iteracoes.value[numero - 1];
                console.log(`\nIteração selecionada: ${iteracaoSelecionada.name}`);
                console.log(`ID: ${iteracaoSelecionada.id}`);
                console.log(`URL: ${iteracaoSelecionada.url}`);
                resolve(iteracaoSelecionada);
            } else {
                console.log('Número inválido. Tente novamente.');
                resolve(null);
            }
        });
    });
}

function gerarHTML(iteracoes) {
    const dataHoraGeracao = new Date().toLocaleString('pt-BR');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    function calcTimeFrame(startISO, finishISO) {
        if (!startISO || !finishISO) return 'future';
        const start = new Date(startISO); start.setHours(0, 0, 0, 0);
        const finish = new Date(finishISO); finish.setHours(0, 0, 0, 0);
        if (finish < hoje) return 'past';
        if (start > hoje) return 'future';
        return 'current';
    }

    const countPast    = iteracoes.value.filter(i => calcTimeFrame(i.attributes.startDate, i.attributes.finishDate) === 'past').length;
    const countCurrent = iteracoes.value.filter(i => calcTimeFrame(i.attributes.startDate, i.attributes.finishDate) === 'current').length;
    const countFuture  = iteracoes.value.filter(i => calcTimeFrame(i.attributes.startDate, i.attributes.finishDate) === 'future').length;

    let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iterações Azure DevOps</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0d2137;
            min-height: 100vh;
            padding: 10px;
            font-size: 13px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        /* Header compacto */
        .header {
            background: linear-gradient(135deg, #1e4d8c 0%, #1a3a5c 100%);
            color: white;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
        }

        .header-title {
            font-size: 1em;
            font-weight: 700;
            letter-spacing: 0.3px;
            white-space: nowrap;
        }

        .header-stats {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .stat-badge {
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 4px;
            padding: 3px 10px;
            font-size: 12px;
            white-space: nowrap;
        }

        .stat-badge strong {
            font-weight: 700;
        }

        /* Filtros compactos */
        .filters {
            padding: 6px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .filter-btn {
            padding: 3px 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            background: white;
            color: #495057;
            transition: all 0.2s ease;
        }

        .filter-btn.active {
            background: #1e4d8c;
            color: white;
            border-color: #1e4d8c;
        }

        .filter-btn:hover:not(.active) {
            background: #e9ecef;
        }

        /* Tabela compacta */
        .table-container {
            overflow-x: auto;
            padding: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: white;
        }

        th, td {
            padding: 6px 10px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }

        th {
            background: #374151;
            font-weight: 600;
            color: #ffffff;
            font-size: 12px;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        tr:nth-child(even) { background: #f8f9fa; }
        tr:hover { background: #dbeafe; }

        .status-past {
            background: #d4edda;
            color: #155724;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }

        .status-current {
            background: #fff3cd;
            color: #856404;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }

        .status-future {
            background: #d1ecf1;
            color: #0c5460;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }

        .iteration-link {
            color: #1e4d8c;
            text-decoration: none;
            font-size: 12px;
        }

        .iteration-link:hover { text-decoration: underline; }

        .path-link {
            color: #1e4d8c;
            text-decoration: none;
            cursor: pointer;
        }

        .path-link:hover { text-decoration: underline; }

        /* Rodapé mínimo */
        .footer {
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            text-align: right;
            padding: 4px 16px;
            font-size: 11px;
        }

        /* Modal compacto */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background-color: #f4f6f8;
            color: #374151;
            margin: 4% auto;
            padding: 0;
            border-radius: 6px;
            width: 90%;
            max-width: 1300px;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 6px 24px rgba(0,0,0,0.4);
        }

        .modal-header {
            background: linear-gradient(135deg, #1e4d8c 0%, #1a3a5c 100%);
            color: white;
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 { margin: 0; font-size: 1em; }

        .close {
            color: white;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
            opacity: 0.8;
        }

        .close:hover { opacity: 1; }

        .modal-body {
            padding: 12px 16px;
            max-height: calc(85vh - 46px);
            overflow-y: auto;
        }

        .workitems-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 12px;
        }

        .workitems-table th,
        .workitems-table td {
            padding: 5px 8px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .workitems-table th {
            background: #f1f3f5;
            font-weight: 600;
            font-size: 11px;
            color: #495057;
        }

        .workitem-link {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
        }

        .workitem-link:hover { text-decoration: underline; }

        .workitem-id {
            color: #1e4d8c;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
        }

        .workitem-id:hover { text-decoration: underline; }

        .loading { color: #1e4d8c; padding: 12px 0; font-size: 13px; }

        .error { background: #fdecea; border-left: 4px solid #e53935; padding: 10px 12px; margin: 8px 0; border-radius: 4px; color: #4a1010; font-size: 12px; }

        .btn-analise-ia {
            background: #1e4d8c;
            color: white;
            border: none;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
        }
        .btn-analise-ia:hover { opacity: 0.8; }
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

        .btn-extracao { background: #388e3c; color: white; border: none; padding: 6px 14px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: 600; margin-top: 10px; }
        .btn-extracao:hover { opacity: 0.85; }
        .btn-extracao:disabled { opacity: 0.5; cursor: not-allowed; }
        .extracao-result { background: #e8f5e9; border-left: 4px solid #388e3c; padding: 10px; margin: 8px 0; border-radius: 4px; color: #374151; }
        .extracao-result h4 { color: #2e7d32; margin: 0 0 8px; font-size: 13px; }

        .sap-result { background: #e8f5e9; border-left: 4px solid #388e3c; padding: 10px; margin: 8px 0; border-radius: 4px; color: #374151; }
        .ado-result { background: #e3edf7; border-left: 4px solid #1e4d8c; padding: 10px; margin: 8px 0; border-radius: 4px; color: #374151; }
        .ado-result h4 { color: #1e4d8c; margin: 0 0 8px; font-size: 13px; }
        .ia-result { background: #edf2f7; border-left: 4px solid #2c5f9e; padding: 10px; margin: 8px 0; border-radius: 4px; color: #374151; }
        .ia-result h4 { margin: 0 0 8px; color: #1e4d8c; font-size: 13px; }
        .ia-content h4 { color: #1a3a5c; margin: 10px 0 4px; font-size: 13px; font-weight: 700; }
        .ia-content ul { margin: 3px 0 6px 16px; padding: 0; }
        .ia-content li { margin: 2px 0; font-size: 12px; color: #374151; }
        .ia-content p { margin: 3px 0; font-size: 12px; color: #374151; }
        pre.result-json { background: #e8edf2; color: #374151; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; max-height: 180px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .detail-table td { padding: 4px 8px; border-bottom: 1px solid #d1d9e0; vertical-align: top; color: #374151; }
        .detail-table td:first-child { font-weight: 600; width: 130px; color: #495057; }

    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="header-title">🔄 Iterações Azure DevOps — Mastersaf Interfaces</span>
            <div class="header-stats">
                <span class="stat-badge">Total: <strong>${iteracoes.count}</strong></span>
                <span class="stat-badge">Concluídas: <strong>${countPast}</strong></span>
                <span class="stat-badge">Atual: <strong>${countCurrent}</strong></span>
                <span class="stat-badge">Futuras: <strong>${countFuture}</strong></span>
            </div>
        </div>

        <div class="filters">
            <button class="filter-btn" onclick="filterTable('all', this)">Todas</button>
            <button class="filter-btn" onclick="filterTable('past', this)">Concluídas</button>
            <button class="filter-btn active" onclick="filterTable('current', this)">Atuais</button>
            <button class="filter-btn" onclick="filterTable('future', this)">Futuras</button>
        </div>

        <div class="table-container">
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
                <tbody>`;

    iteracoes.value.forEach((iteracao, index) => {
        const timeFrame = calcTimeFrame(iteracao.attributes.startDate, iteracao.attributes.finishDate);
        const statusClass = `status-${timeFrame}`;
        const statusText = timeFrame === 'past' ? 'Concluída' :
                          timeFrame === 'current' ? 'Atual' : 'Futura';
        const rowDisplay = timeFrame !== 'current' ? ' style="display:none"' : '';

        html += `
                    <tr data-status="${timeFrame}"${rowDisplay}>
                        <td>${index + 1}</td>
                        <td>${iteracao.name}</td>
                        <td><a href="#" class="path-link" onclick="showWorkItems('${iteracao.id}', '${iteracao.name}')">${iteracao.path.replace('Mastersaf Interfaces\\', '')}</a></td>
                        <td>${formatarData(iteracao.attributes.startDate)}</td>
                        <td>${formatarData(iteracao.attributes.finishDate)}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td><a href="${iteracao.url}" target="_blank" class="iteration-link">Ver no Azure</a></td>
                    </tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>

        <div class="footer">Gerado em ${dataHoraGeracao} | Azure DevOps API</div>
    </div>

    <!-- Modal para Work Items -->
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
                <div id="modalContent" class="loading">
                    Carregando work items...
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Verificar -->
    <div id="analiseModal" class="modal">
        <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, #1e4d8c 0%, #0d2137 100%);">
                <h2 id="analiseModalTitle">Verificar</h2>
                <span class="close" onclick="closeAnaliseModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="analiseModalContent" style="padding:16px;overflow-y:auto;max-height:calc(80vh - 80px);background:#f4f6f8;color:#374151;"></div>
            </div>
        </div>
    </div>

    <script>
        function filterTable(status, button) {
            const rows = document.querySelectorAll('#iterationsTable tbody tr');
            const buttons = document.querySelectorAll('.filter-btn');

            Array.from(buttons).forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            rows.forEach(row => {
                row.style.display = (status === 'all' || row.dataset.status === status) ? '' : 'none';
            });

        }

        async function showWorkItems(iterationId, iterationName) {
            const modal = document.getElementById('workItemsModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalContent');

            modalTitle.textContent = 'Work Items: ' + iterationName;
            modalContent.innerHTML = '<div class="loading">Carregando work items...</div>';
            modal.style.display = 'block';

            try {
                const response = await fetch('https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/949cc173-78b1-4459-be54-be0d7e2ca3f2/_apis/work/teamsettings/iterations/' + iterationId + '/workitems?api-version=7.0', {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Basic ${token}',
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Erro na API: ' + response.status + ' ' + response.statusText);
                }

                const data = await response.json();

                // Resetar filtro de usuário
                const userFilterContainer = document.getElementById('userFilterContainer');
                const userFilter = document.getElementById('userFilter');
                userFilterContainer.style.display = 'none';
                userFilter.innerHTML = '<option value="">Todos</option>';

                if (data.workItemRelations && data.workItemRelations.length > 0) {
                    let html = '<p><strong>Filtrando User Stories...</strong></p>';
                    let userStoryCount = 0;
                    const usersSet = new Set();
                    html += '<table class="workitems-table"><thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Responsável</th><th>Link</th><th>Verificar</th><th>Zendesk</th></tr></thead><tbody>';

                    // Buscar detalhes de cada work item
                    for (const relation of data.workItemRelations) {
                        try {
                            const workItemResponse = await fetch('https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + relation.target.id + '?api-version=7.0', {
                                method: 'GET',
                                headers: {
                                    'Authorization': 'Basic ${token}',
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (workItemResponse.ok) {
                                const workItemData = await workItemResponse.json();
                                const fields = workItemData.fields;

                                if (fields['System.WorkItemType'] === 'User Story') {
                                    userStoryCount++;
                                    const assignee = (fields['System.AssignedTo'] && fields['System.AssignedTo'].displayName) || '-';
                                    if (assignee !== '-') usersSet.add(assignee);
                                    const desc = (fields['System.Title'] || '') + ' ' + (fields['System.Description'] || '');
                                    const zdMatch = desc.match(/Ticket_(\\d+)/i) || desc.match(/TKT(\\d+)/i);
                                    const zdId = zdMatch ? zdMatch[1] : null;
                                    const zdCell = zdId
                                        ? '<td><button class="btn-zendesk" onclick="previewZendesk(' + workItemData.id + ', ' + zdId + ')">🎫 Sincronizar</button></td>'
                                        : '<td style="color:#aaa;text-align:center;font-size:12px">—</td>';
                                    html += '<tr data-user="' + assignee.replace(/"/g, '&quot;') + '"><td><a href="#" class="workitem-id" data-title="' + (fields['System.Title'] || 'N/A').replace(/"/g, '&quot;') + '" onclick="handleWorkItemClick(' + workItemData.id + ', this.dataset.title)">' + workItemData.id + '</a></td><td>' + (fields['System.WorkItemType'] || 'N/A') + '</td><td>' + (fields['System.Title'] || 'N/A') + '</td><td>' + (fields['System.State'] || 'N/A') + '</td><td>' + assignee + '</td><td><a href="' + workItemData._links.html.href + '" target="_blank" class="workitem-link">Ver no Azure</a></td><td><button class="btn-analise-ia" onclick="analisarWorkItem(' + workItemData.id + ')">Verificar</button></td>' + zdCell + '</tr>';
                                }
                            }
                        } catch (error) {
                            console.error('Erro ao buscar work item:', error);
                            html += '<tr><td>' + relation.target.id + '</td><td>Erro</td><td>Não foi possível carregar</td><td>Erro</td><td><a href="https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_workitems/edit/' + relation.target.id + '" target="_blank" class="workitem-link">Ver no Azure</a></td></tr>';
                        }
                    }

                    html += '</tbody></table>';
                    html = '<p><strong>User Stories: ' + userStoryCount + '</strong></p>' + html.replace('<p><strong>Filtrando User Stories...</strong></p>', '');
                    modalContent.innerHTML = html;

                    // Popular filtro de usuário
                    if (usersSet.size > 0) {
                        usersSet.forEach(function(user) {
                            const opt = document.createElement('option');
                            opt.value = user;
                            opt.textContent = user;
                            userFilter.appendChild(opt);
                        });
                        userFilterContainer.style.display = 'block';
                    }
                } else {
                    modalContent.innerHTML = '<p><strong>Nenhum work item encontrado nesta iteração.</strong></p>';
                }

            } catch (error) {
                console.error('Erro ao buscar work items:', error);
                modalContent.innerHTML = '<div class="error">Erro ao carregar work items: ' + error.message + '</div>';
            }
        }

        function closeModal() {
            const modal = document.getElementById('workItemsModal');
            modal.style.display = 'none';
        }

        function filterByUser(user) {
            const rows = document.querySelectorAll('#modalContent .workitems-table tbody tr');
            rows.forEach(function(row) {
                row.style.display = (!user || row.dataset.user === user) ? '' : 'none';
            });
        }

        function handleWorkItemClick(workItemId, workItemTitle) {
            // Função preparada para futuras implementações de API
            console.log('Work Item clicado:', workItemId, workItemTitle);

            // Exemplo de alert - pode ser substituído por chamada de API
            alert('Work Item ID: ' + workItemId + '\\nTítulo: ' + workItemTitle + '\\n\\nAqui pode ser implementada uma chamada de API futura!');

            // TODO: Implementar chamada de API aqui
            // Exemplo:
            // fetchWorkItemDetails(workItemId);
        }

        function formatarAnaliseIA(text) {
            if (!text) return '<em>Sem resposta</em>';
            var safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var lines = safe.split('\\n');
            var html = '';
            var inList = false;
            for (var j = 0; j < lines.length; j++) {
                var line = lines[j];
                if (line.indexOf('## ') === 0) {
                    if (inList) { html += '</ul>'; inList = false; }
                    html += '<h4 style="color:#1e4d8c;margin:12px 0 5px;font-size:14px">' + line.slice(3) + '</h4>';
                } else if (line.indexOf('- ') === 0 || line.indexOf('* ') === 0) {
                    if (!inList) { html += '<ul style="margin:4px 0 6px 18px">'; inList = true; }
                    html += '<li style="margin:2px 0;font-size:13px">' + line.slice(2) + '</li>';
                } else if (line.trim() === '') {
                    if (inList) { html += '</ul>'; inList = false; }
                } else {
                    if (inList) { html += '</ul>'; inList = false; }
                    html += '<p style="margin:3px 0;font-size:13px">' + line + '</p>';
                }
            }
            if (inList) html += '</ul>';
            return html;
        }

        function renderizarGridComparacao(oJson, tCampos) {
            if (!oJson || oJson.length === 0) return '';

            // Agrupa T_CAMPOS por COD_SAFX, ordenado por TAB_ITEM
            var camposPorSafx = {};
            tCampos.forEach(function(c) {
                var s = c.COD_SAFX || '';
                if (!camposPorSafx[s]) camposPorSafx[s] = [];
                camposPorSafx[s].push(c);
            });
            Object.keys(camposPorSafx).forEach(function(s) {
                camposPorSafx[s].sort(function(a, b) { return (a.TAB_ITEM || '').localeCompare(b.TAB_ITEM || ''); });
            });

            // Agrupa O_JSON por SAFX → NUM_LOG
            var bySafx = {};
            oJson.forEach(function(item) {
                var s = item.SAFX || 'SEM_SAFX';
                if (!bySafx[s]) bySafx[s] = {};
                bySafx[s][item.NUM_LOG] = item.JSON || '';
            });

            var html = '';
            Object.keys(bySafx).sort().forEach(function(safx) {
                var logMap = bySafx[safx];
                var numLogs = Object.keys(logMap).sort();
                var campos = camposPorSafx[safx] || [];

                if (campos.length === 0 || numLogs.length < 2) return;

                var keyFields    = campos.filter(function(c) { return c.IND_OBRIG === 'X'; });
                var nonKeyFields = campos.filter(function(c) { return c.IND_OBRIG !== 'X'; });

                // Parseia cada log em registros nomeados { NOME_CAMPO: valor }
                var logData = {};
                numLogs.forEach(function(log) {
                    var rows = (logMap[log] || '').split(/\\r?\\n/).filter(function(r) { return r.trim(); });
                    logData[log] = rows.map(function(row) {
                        var vals = row.split('|');
                        var rec = {};
                        campos.forEach(function(c, idx) { rec[c.NOME_CAMPO] = vals[idx] !== undefined ? vals[idx] : ''; });
                        return rec;
                    });
                });

                // Agrupa por combinação de chaves
                var byKey = {};
                var keyOrder = [];
                numLogs.forEach(function(log) {
                    (logData[log] || []).forEach(function(rec) {
                        var keyStr = keyFields.map(function(k) { return rec[k.NOME_CAMPO] || ''; }).join('|');
                        if (!byKey[keyStr]) { byKey[keyStr] = {}; keyOrder.push(keyStr); }
                        if (!byKey[keyStr][log]) byKey[keyStr][log] = [];
                        byKey[keyStr][log].push(rec);
                    });
                });

                // Encontra grupos com diferenças (chave presente em TODOS os logs)
                var groupsWithDiffs = [];
                keyOrder.forEach(function(keyStr) {
                    var logRecs = byKey[keyStr];
                    if (!numLogs.every(function(log) { return logRecs[log] && logRecs[log].length > 0; })) return;
                    var diffFields = nonKeyFields.filter(function(campo) {
                        var vals = numLogs.map(function(log) { return ((logRecs[log] || [{}])[0] || {})[campo.NOME_CAMPO] || ''; });
                        return !vals.every(function(v) { return v === vals[0]; });
                    });
                    if (diffFields.length > 0) groupsWithDiffs.push({ keyStr: keyStr, logRecs: logRecs, diffFields: diffFields });
                });

                if (groupsWithDiffs.length === 0) return;

                var totalDiffs = groupsWithDiffs.length;
                var limited = groupsWithDiffs.slice(0, 10);

                // Coleta todos os campos com diferença (para colunas consistentes)
                var allDiffFieldNames = [];
                limited.forEach(function(g) {
                    g.diffFields.forEach(function(f) {
                        if (allDiffFieldNames.indexOf(f.NOME_CAMPO) === -1) allDiffFieldNames.push(f.NOME_CAMPO);
                    });
                });

                var colCount = 1 + keyFields.length + allDiffFieldNames.length + 1;

                html += '<details style="margin-bottom:8px;border:1px solid #b8cfe8;border-radius:6px;overflow:hidden">';
                html += '<summary style="cursor:pointer;padding:8px 12px;font-weight:700;color:#1e4d8c;font-size:12px;background:#e3edf7;user-select:none;display:flex;justify-content:space-between;align-items:center;list-style:none">';
                html += '<span>&#9654; ' + safx + '</span>';
                html += '<span style="background:#dc3545;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600">' + totalDiffs + ' doc' + (totalDiffs > 1 ? 's' : '') + ' com diferença' + (totalDiffs > 10 ? ' &nbsp;(top 10)' : '') + '</span>';
                html += '</summary>';
                html += '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px;width:100%;white-space:nowrap">';

                // Cabeçalho
                html += '<thead><tr>';
                html += '<th style="background:#1a3a5c;color:#fff;padding:5px 8px;text-align:left;border-right:2px solid #0d2137">NUM_LOG</th>';
                keyFields.forEach(function(campo) {
                    html += '<th style="background:#1e4d8c;color:#fff;padding:5px 8px;text-align:left;border-right:1px solid rgba(255,255,255,.2)">' +
                        '<span style="font-size:9px;background:rgba(255,255,255,.25);padding:1px 3px;border-radius:2px;margin-right:3px">K</span>' +
                        campo.NOME_CAMPO + '</th>';
                });
                allDiffFieldNames.forEach(function(name) {
                    html += '<th style="background:#7c3a00;color:#fff;padding:5px 8px;text-align:left;border-right:1px solid rgba(255,255,255,.2)">' + name + ' &#9888;</th>';
                });
                html += '<th style="background:#495057;color:#fff;padding:5px 8px;text-align:center">Dif.</th>';
                html += '</tr></thead><tbody>';

                // Linhas agrupadas por combinação de chave
                limited.forEach(function(group, gi) {
                    var groupDiffNames = group.diffFields.map(function(f) { return f.NOME_CAMPO; });
                    numLogs.forEach(function(log, li) {
                        var rec = ((group.logRecs[log] || [])[0]) || {};
                        var rowBg = li % 2 === 0 ? '#ffffff' : '#f8f9fa';
                        html += '<tr>';
                        html += '<td style="padding:3px 8px;border-bottom:1px solid #e9ecef;border-right:2px solid #b8cfe8;font-weight:700;color:#1e4d8c;background:#f0f4fa">' + log + '</td>';
                        keyFields.forEach(function(campo) {
                            var val = rec[campo.NOME_CAMPO] || '';
                            html += '<td style="padding:3px 8px;border-bottom:1px solid #e9ecef;border-right:1px solid #dee2e6;background:#f5f8ff">' + (val || '<span style="color:#ccc">&#8212;</span>') + '</td>';
                        });
                        allDiffFieldNames.forEach(function(name) {
                            var val = rec[name] || '';
                            var isDiff = groupDiffNames.indexOf(name) !== -1;
                            html += '<td style="padding:3px 8px;border-bottom:1px solid #e9ecef;border-right:1px solid #dee2e6;font-family:monospace;background:' + (isDiff ? '#fff3cd' : rowBg) + '">' + (val || '<span style="color:#ccc">&#8212;</span>') + '</td>';
                        });
                        html += '<td style="padding:3px 8px;border-bottom:1px solid #e9ecef;text-align:center;font-weight:700;color:#dc3545">' + (groupDiffNames.length > 0 ? 'X' : '') + '</td>';
                        html += '</tr>';
                    });
                    if (gi < limited.length - 1) {
                        html += '<tr><td colspan="' + colCount + '" style="padding:0;background:#dee2e6;height:3px"></td></tr>';
                    }
                });

                html += '</tbody></table></div>';
                if (totalDiffs > 10) {
                    html += '<p style="font-size:11px;color:#6c757d;margin:4px 10px 6px;font-style:italic">...e mais ' + (totalDiffs - 10) + ' documento(s) com diferenças não exibidos.</p>';
                }
                html += '</details>';
            });
            return html;
        }

        function analisarWorkItem(workItemId, manualZsafe) {
            // Popup de escolha antes de executar
            var modal = document.getElementById('analiseModal');
            var content = document.getElementById('analiseModalContent');
            document.getElementById('analiseModalTitle').textContent = 'Work Item #' + workItemId + ' — O que deseja fazer?';
            content.innerHTML =
                '<div style="display:flex;flex-direction:column;gap:16px;padding:8px 0">' +
                '<div style="background:#fff;border:2px solid #1e4d8c;border-radius:8px;padding:18px 20px;cursor:pointer" onclick="closeAnaliseModal();_analisarWorkItemCompleto(' + workItemId + ',null)">' +
                '<div style="font-size:15px;font-weight:700;color:#1e4d8c;margin-bottom:6px">🔍 Analisar ADO e Programa</div>' +
                '<div style="font-size:12px;color:#555">Consulta o Work Item no ADO, busca o código no SAP (Z_IN_PGM) e realiza análise com IA.<br>Demanda mais tempo.</div>' +
                '</div>' +
                '<div style="background:#fff;border:2px solid #388e3c;border-radius:8px;padding:18px 20px;cursor:pointer" onclick="closeAnaliseModal();_abrirPainelRFC(' + workItemId + ')">' +
                '<div style="font-size:15px;font-weight:700;color:#388e3c;margin-bottom:6px">⚡ Executar RFC / Validar</div>' +
                '<div style="font-size:12px;color:#555">Vai direto para os botões EXECUTA RFC e VALIDAR, sem análise de código.<br>Mais rápido.</div>' +
                '</div>' +
                '</div>';
            modal.style.display = 'block';
        }

        async function _analisarWorkItemCompleto(workItemId, manualZsafe) {
            const modal = document.getElementById('analiseModal');
            const content = document.getElementById('analiseModalContent');
            document.getElementById('analiseModalTitle').textContent = 'Verificar — Work Item #' + workItemId;
            content.innerHTML = '<div class="loading">⏳ Buscando dados do Azure DevOps...</div>';
            modal.style.display = 'block';

            // 1. Fetch ADO work item details
            var adoHtml = '';
            var adoSpec = '';

            try {
                const adoResp = await fetch(
                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '?$expand=all&api-version=7.0',
                    { headers: { 'Authorization': 'Basic ${token}' } }
                );
                const adoData = await adoResp.json();
                const f = adoData.fields || {};
                const title = f['System.Title'] || '';
                const descRaw = f['System.Description'] ? f['System.Description'].replace(/<\\/?(p|div|br|li|tr)[^>]*>/gi, ' ').replace(/<[^>]*>/g, '') : '';
                adoSpec = 'Título: ' + title + '\\nEstado: ' + (f['System.State'] || '') + '\\nDescrição:\\n' + descRaw;

                adoHtml = '<div class="ado-result"><h4>🔵 Azure DevOps — Work Item #' + workItemId + '</h4>' +
                    '<table class="detail-table">' +
                    '<tr><td>Título</td><td>' + (title || '-') + '</td></tr>' +
                    '<tr><td>Tipo</td><td>' + (f['System.WorkItemType'] || '-') + '</td></tr>' +
                    '<tr><td>Estado</td><td>' + (f['System.State'] || '-') + '</td></tr>' +
                    '<tr><td>Responsável</td><td>' + ((f['System.AssignedTo'] && f['System.AssignedTo'].displayName) || '-') + '</td></tr>' +
                    '<tr><td>Sprint</td><td>' + (f['System.IterationPath'] || '-') + '</td></tr>' +
                    '<tr><td>Descrição</td><td>' + (descRaw || '-') + '</td></tr>' +
                    '</table></div>';
            } catch (e) {
                adoHtml = '<div class="error"><h4>❌ ADO — Erro ao buscar detalhes</h4><p>' + e.message + '</p></div>';
            }

            // 2. Fetch ADO comments → extract ZSAFE (padrão: "Processo: ZSAFE...")
            var zsafeCodes = [];
            try {
                const commResp = await fetch(
                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                    { headers: { 'Authorization': 'Basic ${token}' } }
                );
                const commData = await commResp.json();
                var commentsText = '';
                (commData.comments || []).forEach(function(c) {
                    var txt = (c.text || '').replace(/<\\/?(p|div|br|li|tr)[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    commentsText += txt + '\\n';
                    var matches = txt.match(/Processo:\\s*(ZSAFE[A-Z0-9]+)/gi);
                    if (matches) {
                        matches.forEach(function(m) {
                            var code = m.replace(/Processo:\\s*/i, '').trim().toUpperCase();
                            if (code && zsafeCodes.indexOf(code) === -1) zsafeCodes.push(code);
                        });
                    }
                });
                if (commentsText) adoSpec += '\\n\\nComentários:\\n' + commentsText;
            } catch (e) { /* silent */ }

            // Extract parâmetros para Extração SAP — origem: comentários do ADO
            var extProcesso = '';
            var extEmpresa = '';
            var extDataLow = '';
            var extDataHigh = '';
            var mProc = commentsText.match(/Processo:\\s*(ZSAFE[A-Z0-9]+)/i);
            if (mProc) extProcesso = mProc[1].trim().toUpperCase();
            var mEmp = commentsText.match(/Empresa:\\s*(\\S+)/i);
            if (mEmp) extEmpresa = mEmp[1].trim();
            var mPer = commentsText.match(/Per[ií]odo:\\s*(\\d{2}\\.\\d{2}\\.\\d{4})\\s+a\\s+(\\d{2}\\.\\d{2}\\.\\d{4})/i);
            if (mPer) { extDataLow = mPer[1]; extDataHigh = mPer[2]; }

            var missing = [];
            if (!extProcesso) missing.push('Processo: ZSAFE...');
            if (!extEmpresa) missing.push('Empresa: XXXX');
            if (!extDataLow || !extDataHigh) missing.push('Período: DD.MM.AAAA a DD.MM.AAAA');
            var extracaoHtml = '<div style="margin-top:10px">' +
                (missing.length > 0 ? '<div style="background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:8px;font-size:12px;color:#7c5a00">⚠️ Parâmetros incompletos na descrição do ADO: <strong>' + missing.join(' | ') + '</strong></div>' : '') +
                '<button id="btnExtracaoSAP" class="btn-extracao"' +
                ' data-wid="' + workItemId + '"' +
                ' data-proc="' + extProcesso + '"' +
                ' data-emp="' + extEmpresa + '"' +
                ' data-low="' + extDataLow + '"' +
                ' data-high="' + extDataHigh + '"' +
                ' onclick="var b=this;executarExtracaoSAP(b.dataset.wid,b.dataset.proc,b.dataset.emp,b.dataset.low,b.dataset.high)">EXECUTA RFC</button>' +
                ' <button id="btnValidar" class="btn-extracao" style="background:#1e4d8c;"' +
                ' data-wid="' + workItemId + '"' +
                ' onclick="validarExtracao(this.dataset.wid)">VALIDAR</button>' +
                '<div id="extracaoResult"></div>' +
                '</div>';

            // 3. Manual override
            if (manualZsafe) zsafeCodes = [manualZsafe.toUpperCase()];

            // 4. No ZSAFE found → show input form
            if (zsafeCodes.length === 0) {
                content.innerHTML =
                    '<div class="error" style="margin-bottom:12px">⚠️ Nenhum processo encontrado nos comentários do Work Item.<br>Esperado: comentário com "Processo: ZSAFE..."</div>' +
                    '<p style="margin-bottom:8px;font-size:14px">Informe o código do processo:</p>' +
                    '<div style="display:flex;gap:8px;margin-bottom:6px">' +
                    '<input id="zsafeInput" type="text" placeholder="Ex: ZSAFE00001" ' +
                    'style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:14px;text-transform:uppercase">' +
                    '<button onclick="reConsultarZsafe(' + workItemId + ')" ' +
                    'style="background:#1e4d8c;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:600">Consultar</button>' +
                    '</div>' +
                    '<p id="zsafeError" style="color:red;font-size:12px;display:none">❌ Informe o código do processo.</p>' +
                    adoHtml;
                return;
            }

            // 5. For each ZSAFE: SAP RFC → AI analysis
            var allHtml = '';
            for (var i = 0; i < zsafeCodes.length; i++) {
                var zsafe = zsafeCodes[i];
                var sapCode = '';
                var sapHtml = '';

                content.innerHTML = allHtml + '<div class="loading">⏳ Consultando SAP — ' + zsafe + ' (' + (i+1) + '/' + zsafeCodes.length + ')...</div>';

                try {
                    const sapUrl = '/api/analise?workItemId=' + workItemId + '&iZsafe=' + encodeURIComponent(zsafe);
                    const sapResp = await fetch(sapUrl);
                    const sapData = await sapResp.json();
                    if (sapData.success) {
                        sapCode = JSON.stringify(sapData.data, null, 2);
                        lastSuccessSapCode = sapCode;
                        sapHtml = '';
                    } else {
                        sapHtml = '<div class="error"><h4>❌ SAP — Erro na RFC (' + zsafe + ')</h4><p>' + sapData.error + '</p></div>';
                    }
                } catch (e) {
                    sapHtml = '<div class="error"><h4>❌ SAP — Servidor não disponível (' + zsafe + ')</h4><p>Inicie: <code>node sap-mcp-server/api-server.js</code></p></div>';
                }

                var iaHtml = '';
                if (sapCode) {
                    content.innerHTML = allHtml + sapHtml + '<div class="loading">⏳ Analisando com IA — ' + zsafe + '... (pode levar ~30s)</div>';
                    try {
                        const iaResp = await fetch('/api/ia-analise', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ adoSpec: adoSpec, sapCode: sapCode, zsafe: zsafe, workItemId: String(workItemId) })
                        });
                        const iaData = await iaResp.json();
                        if (iaData.success) {
                            iaHtml = '<div class="ia-result"><h4>Verificar — ' + zsafe + '</h4><div class="ia-content">' + formatarAnaliseIA(iaData.analysis) + '</div></div>';
                        } else {
                            iaHtml = '<div class="error"><h4>❌ IA — Erro na análise (' + zsafe + ')</h4><p>' + iaData.error + '</p></div>';
                        }
                    } catch (e) {
                        iaHtml = '<div class="error"><h4>❌ IA — Não disponível</h4><p>' + e.message + '</p></div>';
                    }
                }

                allHtml += sapHtml + iaHtml;
            }

            content.innerHTML = allHtml + adoHtml + extracaoHtml;
        }

        async function reConsultarZsafe(workItemId) {
            const input = document.getElementById('zsafeInput');
            const zsafe = input.value.trim().toUpperCase();
            if (!zsafe) {
                document.getElementById('zsafeError').style.display = 'block';
                return;
            }
            document.getElementById('zsafeError').style.display = 'none';
            await _analisarWorkItemCompleto(workItemId, zsafe);
        }

        async function _abrirPainelRFC(workItemId) {
            const modal = document.getElementById('analiseModal');
            const content = document.getElementById('analiseModalContent');
            document.getElementById('analiseModalTitle').textContent = 'RFC — Work Item #' + workItemId;
            content.innerHTML = '<div class="loading">⏳ Buscando parâmetros do ADO...</div>';
            modal.style.display = 'block';

            var extProcesso = '', extEmpresa = '', extDataLow = '', extDataHigh = '';
            try {
                const commResp = await fetch(
                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                    { headers: { 'Authorization': 'Basic ${token}' } }
                );
                const commData = await commResp.json();
                var commentsText = (commData.comments || []).map(function(c) {
                    return (c.text || '').replace(/<\\\/?(p|div|br|li|tr)[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                }).join('\\n');
                var mProc = commentsText.match(/Processo:\\s*(ZSAFE[A-Z0-9]+)/i);
                if (mProc) extProcesso = mProc[1].trim().toUpperCase();
                var mEmp = commentsText.match(/Empresa:\\s*(\\S+)/i);
                if (mEmp) extEmpresa = mEmp[1].trim();
                var mPer = commentsText.match(/Per[ií]odo:\\s*(\\d{2}\\.\\d{2}\\.\\d{4})\\s+a\\s+(\\d{2}\\.\\d{2}\\.\\d{4})/i);
                if (mPer) { extDataLow = mPer[1]; extDataHigh = mPer[2]; }
            } catch (e) { /* silent */ }

            var missing = [];
            if (!extProcesso) missing.push('Processo: ZSAFE...');
            if (!extEmpresa) missing.push('Empresa: XXXX');
            if (!extDataLow || !extDataHigh) missing.push('Período: DD.MM.AAAA a DD.MM.AAAA');

            content.innerHTML =
                (missing.length > 0 ? '<div style="background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;font-size:12px;color:#7c5a00">⚠️ Parâmetros incompletos: <strong>' + missing.join(' | ') + '</strong></div>' : '') +
                '<div style="margin-bottom:10px">' +
                '<button id="btnExtracaoSAP" class="btn-extracao"' +
                ' data-wid="' + workItemId + '"' +
                ' data-proc="' + extProcesso + '"' +
                ' data-emp="' + extEmpresa + '"' +
                ' data-low="' + extDataLow + '"' +
                ' data-high="' + extDataHigh + '"' +
                ' onclick="var b=this;executarExtracaoSAP(b.dataset.wid,b.dataset.proc,b.dataset.emp,b.dataset.low,b.dataset.high)">EXECUTA RFC</button>' +
                ' <button id="btnValidar" class="btn-extracao" style="background:#1e4d8c;"' +
                ' data-wid="' + workItemId + '"' +
                ' onclick="validarExtracao(this.dataset.wid)">VALIDAR</button>' +
                '<div id="extracaoResult"></div>' +
                '</div>';
        }

        function escHtml(str) {
            var map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
            return String(str || '').replace(/[&<>"']/g, function(m) { return map[m]; });
        }

        async function executarExtracaoSAP(workItemId, processo, empresa, dataLow, dataHigh) {
            var btn = document.getElementById('btnExtracaoSAP');
            var resultDiv = document.getElementById('extracaoResult');
            if (!processo || !empresa || !dataLow || !dataHigh) {
                if (resultDiv) resultDiv.innerHTML = '<div class="error">❌ Preencha na descrição do ADO: Processo, Empresa e Período antes de executar.</div>';
                return;
            }
            if (btn) btn.disabled = true;
            if (resultDiv) resultDiv.innerHTML = '<div class="loading">⏳ Executando RFC Z_IN_EXEC_EXT...</div>';

            try {
                const resp = await fetch('/api/rfc-exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        params: {
                            WA_PARAMETROS: {
                                BUKRS_LOW: empresa,
                                BUKRS_HIGH: empresa,
                                DATE_LOW: dataLow,
                                DATE_HIGH: dataHigh,
                                PROCESSO: processo
                            }
                        }
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    var r = data;
                    resultDiv.innerHTML =
                        '<div class="extracao-result">' +
                        '<h4>✅ Extração SAP — ' + processo + '</h4>' +
                        '<table class="detail-table">' +
                        '<tr><td>O_LOTE</td><td>' + (r.O_LOTE || '-') + '</td></tr>' +
                        '<tr><td>NUM_LOG</td><td>' + (r.NUM_LOG || '-') + '</td></tr>' +
                        '<tr><td>O_OBI</td><td>' + (r.O_OBI || '-') + '</td></tr>' +
                        '</table></div>';

                    // Atualizar comentário do ADO com Número do Teste
                    if (r.NUM_LOG) {
                        try {
                            var commentBody = 'Número do Teste: ' + r.NUM_LOG + (r.O_LOTE ? '\\nLOTE: ' + r.O_LOTE : '');
                            await fetch(
                                'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                                {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Basic ${token}',
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ text: commentBody })
                                }
                            );
                            resultDiv.innerHTML += '<div style="font-size:11px;color:#388e3c;margin-top:6px">✅ Comentário adicionado no ADO: ' + commentBody + '</div>';
                        } catch (eAdo) {
                            resultDiv.innerHTML += '<div style="font-size:11px;color:#dc3545;margin-top:6px">⚠️ Não foi possível atualizar o ADO: ' + eAdo.message + '</div>';
                        }
                    }
                } else {
                    resultDiv.innerHTML = '<div class="error"><h4>❌ Erro na Extração SAP</h4><p>' + (data.error || 'Erro desconhecido') + '</p></div>';
                }
            } catch (e) {
                resultDiv.innerHTML = '<div class="error"><h4>❌ Servidor não disponível</h4><p>' + e.message + '</p></div>';
            }

            if (btn) btn.disabled = false;
        }

        async function validarExtracao(workItemId) {
            var btn = document.getElementById('btnValidar');
            var resultDiv = document.getElementById('extracaoResult');
            if (btn) btn.disabled = true;
            if (resultDiv) resultDiv.innerHTML = '<div class="loading">⏳ Lendo comentários do ADO...</div>';

            try {
                // 1. Buscar comentários do ADO
                const commResp = await fetch(
                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                    { headers: { 'Authorization': 'Basic ${token}' } }
                );
                if (!commResp.ok) throw new Error('ADO comentários HTTP ' + commResp.status + ': ' + await commResp.text());
                const commData = await commResp.json();
                var numLogs = [];
                (commData.comments || []).forEach(function(c) {
                    var txt = (c.text || '').replace(/<\\/?(p|div|br|li|tr)[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                    var m = txt.match(/Número do Teste:\\s*([\\w\\-]+)/i);
                    if (m) numLogs.push(m[1].trim());
                });

                // 2. Verificar se há 2 ou mais
                if (numLogs.length < 2) {
                    resultDiv.innerHTML = '<div style="background:#fff8e1;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 4px 4px 0;font-size:12px;color:#7c5a00">' +
                        '⚠️ Validação requer ao menos 2 comentários com "Número do Teste". Encontrado(s): <strong>' + numLogs.length + '</strong></div>';
                    if (btn) btn.disabled = false;
                    return;
                }

                // 3. Chamar RFC Z_IN_EXEC_VAL
                resultDiv.innerHTML = '<div class="loading">⏳ Executando RFC Z_IN_EXEC_VAL com ' + numLogs.length + ' logs...</div>';
                const valResp = await fetch('/api/rfc-val', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numLogs: numLogs })
                });
                if (!valResp.ok) throw new Error('RFC-VAL HTTP ' + valResp.status + ': ' + await valResp.text());
                const valData = await valResp.json();

                if (valData.success) {
                    var oJson = valData.O_JSON || [];
                    var tCampos = valData.T_CAMPOS || [];
                    resultDiv.innerHTML = '<div id="iaValResult"><div class="loading">⏳ Preparando análise por SAFX...</div></div>';
                    var iaValDiv = document.getElementById('iaValResult');

                    // Agrupa por SAFX
                    var bySafx = {};
                    oJson.forEach(function(item) {
                        var s = item.SAFX || 'SEM_SAFX';
                        if (!bySafx[s]) bySafx[s] = [];
                        bySafx[s].push(item);
                    });
                    // Agrupa campos chave por SAFX
                    var camposPorSafx = {};
                    tCampos.forEach(function(c) {
                        var s = c.COD_SAFX || '';
                        if (!camposPorSafx[s]) camposPorSafx[s] = [];
                        camposPorSafx[s].push({ NOME_CAMPO: c.NOME_CAMPO, IND_OBRIG: c.IND_OBRIG });
                    });
                    var safxKeys = Object.keys(bySafx).sort();
                    var concluidos = 0;
                    iaValDiv.innerHTML = '<div class="loading">⏳ Analisando ' + safxKeys.length + ' SAFXs em paralelo... (0/' + safxKeys.length + ' concluídos)</div>';

                    // Analisa todos os SAFXs em paralelo com 1 retry automático
                    var safxAnalyses = await Promise.all(safxKeys.map(async function(safx) {
                        for (var tentativa = 1; tentativa <= 2; tentativa++) {
                            try {
                                var safxResp = await fetch('/api/ia-val-safx', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ safx: safx, items: bySafx[safx], camposChave: camposPorSafx[safx] || [] })
                                });
                                var safxData = await safxResp.json();
                                if (safxData.success) {
                                    concluidos++;
                                    iaValDiv.innerHTML = '<div class="loading">⏳ Analisando em paralelo... (' + concluidos + '/' + safxKeys.length + ' concluídos)</div>';
                                    return { safx: safx, analysis: safxData.analysis };
                                }
                                if (tentativa === 2) {
                                    concluidos++;
                                    iaValDiv.innerHTML = '<div class="loading">⏳ Analisando em paralelo... (' + concluidos + '/' + safxKeys.length + ' concluídos)</div>';
                                    return { safx: safx, analysis: 'Erro: ' + safxData.error };
                                }
                            } catch (eSafx) {
                                if (tentativa === 2) {
                                    concluidos++;
                                    iaValDiv.innerHTML = '<div class="loading">⏳ Analisando em paralelo... (' + concluidos + '/' + safxKeys.length + ' concluídos)</div>';
                                    return { safx: safx, analysis: 'Erro: ' + eSafx.message };
                                }
                                // tentativa 1 falhou — aguarda 2s e tenta novamente
                                await new Promise(function(r) { setTimeout(r, 2000); });
                            }
                        }
                    }));

                    // Consolida todos os resultados
                    iaValDiv.innerHTML = '<div class="loading">⏳ Consolidando análises (' + safxKeys.length + ' SAFXs)...</div>';
                    try {
                        var consolResp = await fetch('/api/ia-val-consolidar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ analyses: safxAnalyses })
                        });
                        var consolData = await consolResp.json();
                        if (consolData.success) {
                            // Painel de campos chave por SAFX
                            var camposHtml = '';
                            if (Object.keys(camposPorSafx).length > 0) {
                                var linhas = '';
                                safxKeys.forEach(function(s) {
                                    var campos = camposPorSafx[s] || [];
                                    if (campos.length === 0) return;
                                    var obrig = campos.filter(function(c) { return c.IND_OBRIG === 'X'; }).map(function(c) { return c.NOME_CAMPO; });
                                    var outros = campos.filter(function(c) { return c.IND_OBRIG !== 'X'; }).map(function(c) { return c.NOME_CAMPO; });
                                    linhas += '<tr>' +
                                        '<td style="font-weight:600;padding:3px 8px;white-space:nowrap">' + s + '</td>' +
                                        '<td style="padding:3px 8px;color:#1e4d8c">' + (obrig.length ? obrig.join(', ') : '<em style="color:#999">—</em>') + '</td>' +
                                        '<td style="padding:3px 8px;color:#555">' + (outros.length ? outros.join(', ') : '<em style="color:#999">—</em>') + '</td>' +
                                        '</tr>';
                                });
                                if (linhas) {
                                    camposHtml = '<details style="margin-bottom:10px;font-size:12px;border:1px solid #ddd;border-radius:4px;padding:6px 10px">' +
                                        '<summary style="cursor:pointer;font-weight:600;color:#1e4d8c">Campos chave utilizados por SAFX</summary>' +
                                        '<table style="margin-top:8px;border-collapse:collapse;width:100%">' +
                                        '<thead><tr style="background:#f0f4fa">' +
                                        '<th style="padding:3px 8px;text-align:left">SAFX</th>' +
                                        '<th style="padding:3px 8px;text-align:left">Chaves (IND_OBRIG)</th>' +
                                        '<th style="padding:3px 8px;text-align:left">Demais campos</th>' +
                                        '</tr></thead><tbody>' + linhas + '</tbody></table></details>';
                                }
                            }
                            var gridHtml = renderizarGridComparacao(oJson, tCampos);
                            var gridSection = gridHtml
                                ? '<div style="margin-bottom:14px"><div style="background:#374151;color:#fff;padding:7px 12px;border-radius:4px 4px 0 0;font-size:12px;font-weight:600">&#128202; Documentos com Diferença por SAFX &mdash; clique no SAFX para expandir</div><div style="padding:10px 0">' + gridHtml + '</div></div>'
                                : '';
                            iaValDiv.innerHTML = gridSection + camposHtml + '<div class="ia-result"><h4>Análise de Diferenças entre Logs</h4><div class="ia-content">' + formatarAnaliseIA(consolData.analysis) + '</div></div>';
                            // Grava análise no ADO
                            try {
                                await fetch(
                                    'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/workitems/' + workItemId + '/comments?api-version=7.0-preview.3',
                                    {
                                        method: 'POST',
                                        headers: { 'Authorization': 'Basic ${token}', 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ text: 'Análise VALIDAR:\\n\\n' + consolData.analysis })
                                    }
                                );
                                iaValDiv.innerHTML += '<div style="font-size:11px;color:#388e3c;margin-top:6px">✅ Análise registrada no ADO.</div>';
                            } catch (eAdo) {
                                iaValDiv.innerHTML += '<div style="font-size:11px;color:#dc3545;margin-top:6px">⚠️ Não foi possível registrar no ADO: ' + eAdo.message + '</div>';
                            }
                        } else {
                            iaValDiv.innerHTML = '<div class="error"><h4>❌ Erro na Consolidação</h4><p>' + (consolData.error || 'Erro desconhecido') + '</p></div>';
                        }
                    } catch (eConsol) {
                        iaValDiv.innerHTML = '<div class="error"><h4>❌ IA indisponível</h4><p>' + eConsol.message + '</p></div>';
                    }
                } else {
                    resultDiv.innerHTML = '<div class="error"><h4>❌ Erro na Validação</h4><p>' + (valData.error || 'Erro desconhecido') + '</p></div>';
                }
            } catch (e) {
                resultDiv.innerHTML = '<div class="error"><h4>❌ Erro</h4><p>' + e.message + '</p></div>';
            }

            if (btn) btn.disabled = false;
        }

        function closeAnaliseModal() {
            document.getElementById('analiseModal').style.display = 'none';
        }

        function closeZendeskModal() {
            document.getElementById('zendeskModal').style.display = 'none';
        }


        // Fechar modal ao clicar fora dele
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

        async function previewZendesk(workItemId, zendeskId) {
            const modal   = document.getElementById('zendeskModal');
            const title   = document.getElementById('zdModalTitle');
            const body    = document.getElementById('zdModalBody');
            title.textContent = '🎫 Zendesk — Ticket #' + zendeskId;
            body.innerHTML = '<div class="loading">⏳ Buscando dados do Zendesk...</div>';
            modal.style.display = 'block';

            try {
                const resp = await fetch('/api/zendesk/ticket?id=' + zendeskId);
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
                    '<button class="btn-analise-ia" style="background:#17a589" onclick="confirmZendeskSync(' + workItemId + ', ' + zendeskId + ', this)">✅ Confirmar Sincronização</button>' +
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
                const resp = await fetch('/api/zendesk/sync-to-ado', {
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

    </script>

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

    return html;
}

function salvarHTML(html, nomeArquivo = 'iteracoes_ado.html') {
    try {
        fs.writeFileSync(nomeArquivo, html, 'utf8');
        console.log(`\n✅ Arquivo HTML gerado: ${nomeArquivo}`);
        return nomeArquivo;
    } catch (error) {
        console.error('Erro ao salvar arquivo HTML:', error.message);
        throw error;
    }
}

async function executarPrograma() {
    try {
        console.log('Buscando iterações do Azure DevOps...');
        const dados = await buscaIteracoesADO();

        exibirTabela(dados);

        // Gerar e salvar HTML
        console.log('Gerando arquivo HTML...');
        const html = gerarHTML(dados);
        const nomeArquivo = salvarHTML(html);

        console.log(`📁 Arquivo salvo como: ${nomeArquivo}`);
        console.log('🌐 Abra o arquivo no navegador para visualizar a tabela interativa');

        const iteracaoSelecionada = await selecionarIteracao(dados);

        if (iteracaoSelecionada) {
            // Aqui podem ser implementadas ações futuras
            console.log('\nAções futuras podem ser implementadas aqui...');
        }

    } catch (error) {
        console.error('Erro no programa:', error.message);
        process.exit(1);
    }
}

// Executar a função se o arquivo for executado diretamente
if (require.main === module) {
    executarPrograma();
}

module.exports = { buscaIteracoesADO, exibirTabela, selecionarIteracao, gerarHTML, salvarHTML };
