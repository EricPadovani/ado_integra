# Filtro por Usuário no Modal de Work Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um dropdown acima da tabela de work items que filtra as linhas por responsável (`System.AssignedTo`), sem novas chamadas à API.

**Architecture:** Toda a lógica vive no arquivo `iteracoes_ado.html`. A função `showWorkItems` é modificada para (1) adicionar `data-assigned` em cada `<tr>`, (2) coletar os usuários únicos e (3) injetar o `<select>` acima da tabela quando houver 2+ usuários distintos. Uma nova função `filterByUser` aplica `display: none/''` nas linhas conforme a seleção.

**Tech Stack:** HTML, JavaScript vanilla (sem frameworks, sem dependências externas)

---

### Task 1: Adicionar `data-assigned` às linhas da tabela

**Files:**
- Modify: `iteracoes_ado.html` — função `showWorkItems`, linha ~1159

- [ ] **Step 1: Localizar a linha onde o `<tr>` de User Story é gerado**

  Na função `showWorkItems`, encontre esta linha (em torno da linha 1159):

  ```javascript
  html += '<tr><td><a href="#" class="workitem-id" ...
  ```

- [ ] **Step 2: Adicionar o atributo `data-assigned` ao `<tr>`**

  Substitua a linha que gera o `<tr>` para incluir o atributo. O campo de responsável é `fields['System.AssignedTo']` — quando preenchido, é um objeto com propriedade `displayName`:

  ```javascript
  const assignedTo = (fields['System.AssignedTo'] && fields['System.AssignedTo'].displayName)
      ? fields['System.AssignedTo'].displayName
      : 'Sem responsável';

  html += '<tr data-assigned="' + assignedTo.replace(/"/g, '&quot;') + '"><td><a href="#" class="workitem-id" data-title="' + (fields['System.Title'] || 'N/A').replace(/"/g, '&quot;') + '" onclick="handleWorkItemClick(' + workItemData.id + ', this.dataset.title)">' + workItemData.id + '</a></td><td>' + (fields['System.WorkItemType'] || 'N/A') + '</td><td>' + (fields['System.Title'] || 'N/A') + '</td><td>' + (fields['System.State'] || 'N/A') + '</td><td><a href="' + workItemData._links.html.href + '" target="_blank" class="workitem-link">Ver no Azure</a></td><td><button class="btn-analise-ia" onclick="analisarWorkItem(' + workItemData.id + ')">Verificar</button></td></tr>';
  ```

  Isso substitui a linha original inteira — a única mudança real é `<tr data-assigned="...">` no início.

- [ ] **Step 3: Verificar no browser**

  Abra `iteracoes_ado.html`, clique em uma iteração, abra o DevTools (F12 → Elements) e confirme que as linhas da tabela têm `data-assigned="Nome do Usuário"`.

---

### Task 2: Coletar usuários únicos e injetar o dropdown

**Files:**
- Modify: `iteracoes_ado.html` — função `showWorkItems`, linha ~1159 (bloco de coleta) e ~1169 (injeção do HTML final)

- [ ] **Step 1: Adicionar acumulador de usuários no início do bloco `if (data.workItemRelations...)`**

  Logo após a linha `let userStoryCount = 0;`, adicione:

  ```javascript
  let assignedUsers = [];
  ```

- [ ] **Step 2: Acumular o usuário de cada User Story**

  Logo após definir `assignedTo` (Task 1, Step 2), adicione:

  ```javascript
  if (assignedUsers.indexOf(assignedTo) === -1) {
      assignedUsers.push(assignedTo);
  }
  ```

- [ ] **Step 3: Construir e injetar o dropdown após o loop**

  Substitua o bloco que finaliza o HTML (linha ~1168-1170):

  **Antes:**
  ```javascript
  html += '</tbody></table>';
  html = '<p><strong>User Stories: ' + userStoryCount + '</strong></p>' + html.replace('<p><strong>Filtrando User Stories...</strong></p>', '');
  modalContent.innerHTML = html;
  ```

  **Depois:**
  ```javascript
  html += '</tbody></table>';

  // Monta dropdown de filtro por usuário (só quando há 2+ usuários distintos)
  var filterHtml = '';
  if (assignedUsers.length >= 2) {
      assignedUsers.sort();
      filterHtml = '<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:12px;color:#495057;font-weight:600">Filtrar por:</span>' +
          '<select id="userFilterSelect" onchange="filterByUser(this)" style="padding:3px 8px;border:1px solid #ced4da;border-radius:4px;font-size:12px;color:#495057">' +
          '<option value="all">Todos os usuários</option>' +
          assignedUsers.map(function(u) {
              return '<option value="' + u.replace(/"/g, '&quot;') + '">' + u + '</option>';
          }).join('') +
          '</select>' +
          '</div>';
  }

  var countHtml = '<p><strong>User Stories: ' + userStoryCount + '</strong></p>';
  modalContent.innerHTML = countHtml + filterHtml + html.replace('<p><strong>Filtrando User Stories...</strong></p>', '');
  ```

- [ ] **Step 4: Verificar no browser**

  Abra uma iteração com work items de 2+ responsáveis diferentes. Confirme que o dropdown aparece acima da tabela com "Todos os usuários" como padrão e os nomes dos responsáveis como opções.

  Em iterações com apenas 1 responsável, o dropdown não deve aparecer.

---

### Task 3: Implementar a função `filterByUser`

**Files:**
- Modify: `iteracoes_ado.html` — bloco `<script>`, logo após a função `closeModal` (~linha 1184)

- [ ] **Step 1: Adicionar a função `filterByUser` no bloco `<script>`**

  Após a função `closeModal`:

  ```javascript
  function filterByUser(selectEl) {
      var value = selectEl.value;
      var rows = document.querySelectorAll('#modalContent .workitems-table tbody tr');
      var visibleCount = 0;

      rows.forEach(function(row) {
          if (value === 'all' || row.dataset.assigned === value) {
              row.style.display = '';
              visibleCount++;
          } else {
              row.style.display = 'none';
          }
      });

      // Mensagem quando nenhum item corresponde
      var noResultMsg = document.getElementById('userFilterNoResult');
      if (visibleCount === 0) {
          if (!noResultMsg) {
              var msg = document.createElement('p');
              msg.id = 'userFilterNoResult';
              msg.style.cssText = 'color:#6c757d;font-size:13px;margin-top:8px';
              msg.textContent = 'Nenhum item para este usuário.';
              selectEl.parentElement.insertAdjacentElement('afterend', msg);
          }
      } else {
          if (noResultMsg) noResultMsg.remove();
      }
  }
  ```

- [ ] **Step 2: Testar o filtro no browser**

  1. Abra uma iteração com 2+ responsáveis
  2. Selecione um usuário no dropdown → apenas as linhas desse usuário devem aparecer
  3. Selecione "Todos os usuários" → todas as linhas voltam a aparecer
  4. Selecione um usuário sem nenhum item atribuído (se possível) → mensagem "Nenhum item para este usuário." deve aparecer

- [ ] **Step 3: Verificar que o dropdown some ao fechar e reabrir o modal**

  Feche o modal e abra uma iteração diferente. O dropdown deve ser reconstruído com os usuários da nova iteração (não persistir dados da anterior).

---

### Task 4: Revisão final e limpeza

**Files:**
- Modify: `iteracoes_ado.html` — revisão geral

- [ ] **Step 1: Confirmar sintaxe JS sem erros**

  Execute no terminal:
  ```bash
  python3 -c "
  import re
  with open('C:/vscode/ado/iteracoes_ado.html', 'r', encoding='utf-8') as f:
      content = f.read()
  match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
  with open('C:/vscode/ado/ado_script_check.js', 'w', encoding='utf-8') as out:
      out.write(match.group(1))
  "
  node --check C:/vscode/ado/ado_script_check.js && echo "OK" && rm C:/vscode/ado/ado_script_check.js
  ```

  Esperado: `OK`

- [ ] **Step 2: Teste de regressão — filtros de iteração ainda funcionam**

  Abra `iteracoes_ado.html` e clique nos botões Todas / Concluídas / Atuais / Futuras. Confirme que continuam filtrando as linhas da tabela principal corretamente.
