# Design: ADO Web App no Azure App Service

**Data:** 2026-04-22  
**Status:** Aprovado

## Objetivo

Transformar o projeto `ado` (CLI Node.js) em uma aplicação web hospedada no Azure App Service, acessível por colegas via Zscaler VPN sem necessidade de instalação local.

## Arquitetura

```
[Navegador do colega]
        │
        │  HTTPS (via Zscaler)
        ▼
[Azure App Service]
  ├── Express server (Node.js)
  │     ├── GET /          → serve página HTML
  │     └── GET /iteracoes → chama API do Azure DevOps
  │                           usando ADO_TOKEN (env var)
  └── Variáveis de ambiente
        └── ADO_TOKEN (token seguro, nunca exposto)

[Azure DevOps API]  ← chamado apenas pelo servidor
```

## Componentes

### Estrutura de Arquivos

```
ado/
├── server.js          ← novo (Express + rotas)
├── busca_ado.js       ← refatorado (só lógica, sem readline)
├── public/
│   └── index.html     ← frontend adaptado do iteracoes_ado.html
├── .env               ← local apenas (ADO_TOKEN=xxx)
├── .gitignore         ← inclui .env
└── package.json       ← adiciona express como dependência
```

### server.js
- Serve o `public/index.html` na rota `GET /`
- Expõe `GET /iteracoes` que chama a API do Azure DevOps usando `ADO_TOKEN` do ambiente e retorna JSON

### busca_ado.js
- Refatorado para exportar a função de busca como módulo
- Remove dependência de `readline` (interação via terminal)
- Mantém toda lógica de chamada à API do ADO

### public/index.html
- Adaptado do `iteracoes_ado.html` existente
- Usa `fetch('/iteracoes')` para buscar dados do servidor
- Renderiza tabela de iterações no browser

## Fluxo de Dados

1. Colega acessa a URL do Azure App Service via navegador
2. Servidor retorna `index.html`
3. Página chama `GET /iteracoes`
4. Servidor busca iterações no Azure DevOps usando `ADO_TOKEN`
5. Servidor retorna JSON ao frontend
6. Frontend renderiza a tabela

## Segurança

- `ADO_TOKEN` configurado como variável de ambiente no Azure App Service — nunca no código ou repositório git
- `.env` incluído no `.gitignore`
- Servidor não expõe o token em nenhuma resposta ao frontend
- HTTPS garantido pelo Azure App Service por padrão
- Sem autenticação de usuário (qualquer pessoa com a URL acessa) — adequado para uso interno via Zscaler

## Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| `ADO_TOKEN` ausente no servidor | Retorna HTTP 500 com mensagem clara |
| ADO API indisponível | Frontend exibe mensagem de erro amigável |
| Token inválido ou expirado | Frontend exibe aviso para contatar o administrador |

## Deploy

- Código hospedado no GitHub
- Deploy automático via GitHub Actions (push na branch `master` → deploy no Azure)
- `ADO_TOKEN` configurado manualmente no painel do Azure App Service (Configuration > App Settings)
