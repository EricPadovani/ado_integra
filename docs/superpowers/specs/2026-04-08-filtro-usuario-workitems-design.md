# Filtro por Usuário no Modal de Work Items

**Data:** 2026-04-08  
**Contexto:** iteracoes_ado.html — modal que exibe Work Items de uma iteração Azure DevOps

## Problema

O modal de Work Items carrega todos os itens da iteração sem possibilidade de filtrar por responsável. Em iterações com muitos usuários, fica difícil visualizar apenas os items de uma pessoa.

## Solução

Filtro client-side por usuário, aplicado após o carregamento completo dos work items.

## Comportamento

- O modal abre e carrega todos os work items normalmente (sem mudança no fluxo de fetch)
- Após o carregamento, acima da tabela aparece um `<select>` com:
  - Primeira opção: "Todos os usuários" (padrão)
  - Demais opções: nomes únicos dos responsáveis (`System.AssignedTo.displayName`), ordenados alfabeticamente
  - Items sem responsável agrupados como "Sem responsável"
- O dropdown só é exibido quando há 2 ou mais usuários distintos
- Ao mudar a seleção, as linhas da tabela são filtradas imediatamente via `display: none / ''`
- Se nenhuma linha corresponder ao filtro: mensagem "Nenhum item para este usuário"

## Mudanças no Código

### `showWorkItems` (função existente)
- Após montar o HTML da tabela, adiciona atributo `data-assigned` em cada `<tr>` com o nome do responsável
- Extrai os nomes únicos, ordena alfabeticamente
- Injeta o `<select id="userFilter">` antes da tabela (só se ≥ 2 usuários distintos)

### Nova função `filterByUser(selectEl)`
- Lê `selectEl.value`
- Percorre todas as `<tr>` da tabela de work items
- Se valor = "all": mostra todas
- Caso contrário: mostra apenas rows onde `data-assigned === valor`
- Atualiza mensagem de "nenhum resultado" se todas ficarem ocultas

## Estilo

Dropdown compacto, consistente com o restante do modal:
```
Filtrar por: [Todos os usuários ▼]
```
Posicionado entre o título da contagem de User Stories e a tabela.
