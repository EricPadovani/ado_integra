# Filtro Area Path + Iteration Path — Design Spec

**Data:** 2026-04-17  
**Status:** Aprovado

---

## Resumo

Adicionar uma barra de filtro no topo da página `iteracoes_ado.html` com seletores em cascata para **Area Path** e **Iteration Path**. A tabela de iterações fica oculta ao carregar a página e só é exibida após o usuário aplicar os filtros.

---

## Comportamento

### Ao abrir a página
1. A barra de filtro é exibida no topo, abaixo do header.
2. Dois chamadas são feitas ao servidor (`/api/areas-tree` e `/api/iterations-tree`) para carregar as hierarquias do ADO.
3. Os dropdowns em cascata são montados com os dados retornados.
4. A tabela de iterações fica **oculta** com mensagem: _"Selecione Area Path e Iteration Path acima e clique em Filtrar para ver as iterações."_

### Ao selecionar os filtros
- **Area Path (cascata):** Cada nível mostra os filhos do nó selecionado no nível anterior. Raiz: filhos diretos de `Mastersaf Interfaces`. Exemplo: `IFC` → `Interface SAP` → `Interfaces SAP`.
- **Iteration Path (cascata):** Mesma lógica. Raiz: filhos diretos de `Mastersaf Interfaces`. Exemplo: `2026` → `Q2` → `(todos os sprints)` ou sprint específico.
- O último nível do Iteration Path oferece a opção `(todos os sprints)` além dos sprints individuais.

### Ao clicar "Filtrar"
1. A tabela é exibida, mostrando apenas as linhas cujo `data-path` começa com o Iteration Path selecionado.
2. O Area Path selecionado é armazenado em variável JavaScript para uso posterior.
3. O header mostra um badge com o resumo dos filtros ativos.

### Ao clicar "Limpar"
- Filtros resetados, tabela ocultada novamente.

### Ao clicar em um sprint (ver work items)
- A requisição de work items usa o Area Path guardado como filtro adicional na query WIQL.

---

## Componentes

### 1. Novos endpoints em `busca_ado.js`

**`GET /api/areas-tree`**
- Chama: `https://dev.azure.com/tr-ggo/{project}/_apis/wit/classificationnodes/areas?$depth=10&api-version=7.0`
- Retorna: JSON com a árvore de nós de Area Path.

**`GET /api/iterations-tree`**
- Chama: `https://dev.azure.com/tr-ggo/{project}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.0`
- Retorna: JSON com a árvore de nós de Iteration Path.

Ambos usam o mesmo `ADO_TOKEN` já configurado no `.env`.

### 2. Barra de filtro em `iteracoes_ado.html`

**HTML** — inserido entre o header e os botões de status (Todas/Concluídas/Atuais/Futuras):

```
[AREA PATH]  IFC  ›  Interface SAP  ›  Interfaces SAP
[ITERATION]  2026  ›  Q2  ›  (todos os sprints)
[Filtrar]  [Limpar]
```

**Estilo:** fundo `#f0f4ff`, borda inferior `#c7d6f5`, alinhado com o tema azul existente.

### 3. JavaScript de cascata

- Ao receber a árvore do servidor, monta a estrutura em memória.
- Quando o usuário seleciona um nó, popula o próximo dropdown com os filhos.
- Dropdowns vazios (sem filhos) são ocultados.
- Mantém variáveis `selectedAreaPath` e `selectedIterationPath`.

### 4. Lógica de filtragem da tabela

- `busca_ado.js` precisa adicionar `data-path="2026\Q2\2026_S08_Apr08-Apr21"` em cada `<tr>` gerado (atualmente as linhas só têm `data-status`).
- Ao clicar "Filtrar", percorre todas as linhas e aplica `display: none` nas que não começam com o Iteration Path selecionado.
- Combina com os filtros de status já existentes (Todas/Atuais/Futuras/Concluídas).

### 5. Integração com work items

- A função `showWorkItems(iterationId, iterationName)` existente recebe um parâmetro adicional opcional `areaPath`.
- O endpoint atual retorna work items individualmente com todos os campos. Se `areaPath` estiver preenchido, filtra os work items **no cliente** checando se `fields['System.AreaPath']` começa com o valor selecionado, antes de renderizar a tabela do modal.

---

## Fluxo de dados

```
Abrir página
  → fetch /api/areas-tree     → monta dropdowns de Area
  → fetch /api/iterations-tree → monta dropdowns de Iteration
  → tabela oculta

Usuário seleciona Area + Iteration → clica Filtrar
  → filtra linhas da tabela por Iteration Path (client-side)
  → guarda selectedAreaPath

Usuário clica em sprint
  → showWorkItems(id, nome, selectedAreaPath)
  → work items retornados são filtrados client-side por System.AreaPath
```

---

## O que não muda

- Geração do HTML (`busca_ado.js` como servidor) permanece igual.
- Estrutura da tabela de iterações permanece igual.
- Modais de work items, RFC, Zendesk permanecem iguais.
- Os botões de status (Todas/Atuais/Futuras/Concluídas) continuam funcionando em conjunto com o novo filtro.

---

## Fora de escopo

- Persistência dos filtros entre sessões (sem localStorage por enquanto).
- Múltiplas seleções de Area Path simultâneas.
- Filtro por Area Path na lista de iterações (Area Path só afeta work items).
