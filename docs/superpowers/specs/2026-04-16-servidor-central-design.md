# Design: Disponibilizar aplicação para colegas via servidor central

**Data:** 2026-04-16
**Status:** Aprovado

## Objetivo

Permitir que colegas do mesmo time acessem o `iteracoes_ado.html` via browser sem instalar nada, usando uma máquina central na rede interna que serve o frontend e o backend.

## Arquitetura

```
[Máquina Central]
  ├── api-server.js (porta 3001, escuta em 0.0.0.0)
  │     ├── GET /              → serve iteracoes_ado.html
  │     ├── /api/rfc-exec      → executa RFC SAP
  │     ├── /api/rfc-val       → valida RFC SAP
  │     ├── /api/analise       → análise com IA
  │     ├── /api/ia-analise    → análise IA work item
  │     ├── /api/zendesk/*     → integração Zendesk
  │     └── demais rotas existentes (sem alteração)
  │
  └── iniciar.bat (sobe o servidor e exibe IP da máquina)

[Colega na rede interna]
  └── Abre http://IP_DA_MAQUINA:3001 no browser → acesso completo
```

## Mudanças necessárias

### 1. `sap-mcp-server/api-server.js`

- Trocar `listen` de `localhost` para `0.0.0.0` para aceitar conexões da rede interna
- Adicionar rota `GET /` que serve o arquivo `iteracoes_ado.html` com `fs.readFile`

### 2. `iteracoes_ado.html`

- Substituir todas as ocorrências de `http://localhost:3001` por caminhos relativos (`/api/...`)
- Isso garante que o HTML funciona independentemente do IP da máquina que o serve

### 3. `iniciar.bat`

- Ao subir o servidor, detectar e exibir o IP da máquina na rede (`ipconfig`)
- Exibir mensagem: `Acesse pelo browser: http://IP:3001`
- Liberar porta 3001 no firewall do Windows via `netsh advfirewall`

## Fluxo de uso

1. Operador executa `iniciar.bat` na máquina central
2. Terminal exibe o IP e a URL de acesso
3. Colega abre `http://IP_DA_MAQUINA:3001` no browser
4. Página carrega com todas as funcionalidades (SAP, IA, Zendesk)
5. Quando há nova versão do HTML (via `busca_ado.js`), colegas veem automaticamente no próximo acesso

## Fora do escopo

- Autenticação de usuários (login/senha)
- HTTPS / certificado SSL
- Múltiplas instâncias do servidor
- Registro como serviço Windows (pode ser adicionado futuramente)
