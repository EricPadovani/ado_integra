# Servidor Central — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que colegas na rede interna acessem a aplicação via browser em `http://IP_DA_MAQUINA:3001`, sem instalar nada localmente.

**Architecture:** O `api-server.js` passa a escutar em `0.0.0.0` (aceita conexões da rede) e serve o `iteracoes_ado.html` na rota `GET /`. O HTML troca todas as referências a `http://localhost:3001` por caminhos relativos (`/api/...`). O `iniciar.bat` detecta o IP da máquina e o exibe ao subir.

**Tech Stack:** Node.js (http nativo), Windows batch script, `ipconfig` para detecção de IP, `netsh advfirewall` para liberação de porta.

---

### Task 1: Fazer `api-server.js` escutar na rede e servir o HTML

**Files:**
- Modify: `C:\vscode\sap-mcp-server\api-server.js:806-811`

- [ ] **Step 1: Alterar o `server.listen` para escutar em `0.0.0.0`**

Localizar a linha 806 do arquivo `C:\vscode\sap-mcp-server\api-server.js` e substituir:

```js
// DE:
server.listen(PORT, () => {
  console.log(`✅ SAP API Server rodando em http://localhost:${PORT}`);
  console.log(`   Abra no navegador: http://localhost:${PORT}`);
  console.log(`   Endpoint SAP:      http://localhost:${PORT}/api/analise?workItemId=123`);
  console.log(`   Endpoint IA:       http://localhost:${PORT}/api/ia-analise (POST)`);
});

// PARA:
server.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }
  console.log(`✅ SAP API Server rodando`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Rede:   http://${localIp}:${PORT}`);
  console.log(`   Compartilhe com seus colegas: http://${localIp}:${PORT}`);
});
```

- [ ] **Step 2: Verificar se já existe rota `GET /` no servidor**

Abrir `C:\vscode\sap-mcp-server\api-server.js` e procurar por `req.url === '/'`. Se não existir, prosseguir com o Step 3.

- [ ] **Step 3: Adicionar rota `GET /` para servir o HTML**

Localizar no arquivo o bloco do `requestListener` (função que trata as requisições HTTP). Adicionar antes do bloco `res.writeHead(404)` (linha ~802):

```js
  // Serve o frontend
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
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

> Nota: `HTML_FILE` já está definido na linha 16 do arquivo como `path.join(__dirname, '..', 'ado', 'iteracoes_ado.html')` — não precisa redefinir.

- [ ] **Step 4: Testar manualmente**

Abrir terminal em `C:\vscode\sap-mcp-server` e rodar:
```
node api-server.js
```
Esperado no console:
```
✅ SAP API Server rodando
   Local:  http://localhost:3001
   Rede:   http://192.168.X.X:3001
   Compartilhe com seus colegas: http://192.168.X.X:3001
```
Abrir `http://localhost:3001` no browser — deve carregar o `iteracoes_ado.html`.

- [ ] **Step 5: Commit**

```bash
cd C:\vscode\sap-mcp-server
git add api-server.js
git commit -m "feat: escuta em 0.0.0.0 e serve HTML na rota GET /"
```

> Nota: se `C:\vscode\sap-mcp-server` não for um repositório git separado, fazer o commit no repositório `C:\vscode\ado`.

---

### Task 2: Trocar `localhost:3001` por caminhos relativos no HTML

**Files:**
- Modify: `C:\vscode\ado\iteracoes_ado.html` (linhas 1552, 1570, 1666, 1754, 1790, 1821, 1921, 1961)

- [ ] **Step 1: Substituir todas as ocorrências de `http://localhost:3001` por string vazia**

As 8 ocorrências estão nas linhas listadas. Cada uma segue o padrão:
```js
fetch('http://localhost:3001/api/...')
```
Deve virar:
```js
fetch('/api/...')
```

Fazer a substituição global no arquivo — trocar `http://localhost:3001` por `` (string vazia) em todo o arquivo.

- [ ] **Step 2: Verificar que não restou nenhuma ocorrência**

Abrir o arquivo e buscar por `localhost:3001`. Resultado esperado: nenhuma ocorrência.

- [ ] **Step 3: Testar manualmente**

Com o `api-server.js` rodando (Task 1), abrir `http://localhost:3001` no browser e testar:
- Clicar em uma iteração → modal de Work Items abre e carrega
- Clicar em "Verificar" num work item → chama `/api/analise` corretamente
- Clicar em "Zendesk" → chama `/api/zendesk/ticket` corretamente

- [ ] **Step 4: Commit**

```bash
cd C:\vscode\ado
git add iteracoes_ado.html
git commit -m "feat: troca localhost:3001 por caminhos relativos no HTML"
git push
```

---

### Task 3: Atualizar `iniciar.bat` para exibir IP e liberar firewall

**Files:**
- Modify: `C:\vscode\ado\iniciar.bat`

- [ ] **Step 1: Substituir o conteúdo do `iniciar.bat`**

Reescrever o arquivo com o seguinte conteúdo:

```bat
@echo off
title ADO + SAP Analise IA
cd /d "%~dp0"

echo.
echo ============================================
echo   ADO ^| SAP ^| Analise IA
echo ============================================
echo.

REM Verifica se Node.js esta instalado
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

REM Adiciona DLLs SAP ao PATH
set "RFC_DLL=%~dp0..\nwrfcsdk"
if exist "%RFC_DLL%" set "PATH=%RFC_DLL%;%PATH%"

REM Mata instancia anterior do servidor na porta 3001
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [1/4] Liberando porta 3001 no firewall...
netsh advfirewall firewall delete rule name="ADO Integra 3001" >nul 2>&1
netsh advfirewall firewall add rule name="ADO Integra 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1

echo [2/4] Gerando lista de iteracoes ADO...
node busca_ado.js
if errorlevel 1 (
    echo [ERRO] Falha ao gerar HTML. Verifique o arquivo .env
    pause
    exit /b 1
)

echo.
echo [3/4] Iniciando servidor SAP + IA...
start "" /B node "..\sap-mcp-server\api-server.js"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Detectando IP da maquina na rede...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set "LOCAL_IP=%%a"
    goto :found_ip
)
:found_ip
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
echo ============================================
echo   Servidor rodando!
echo.
echo   Acesso local:  http://localhost:3001
echo   Acesso da rede: http://%LOCAL_IP%:3001
echo.
echo   Compartilhe com seus colegas:
echo   http://%LOCAL_IP%:3001
echo ============================================
echo.
echo   Mantenha esta janela aberta.
echo   Feche esta janela para encerrar o servidor.
echo ============================================
echo.
pause

REM Ao fechar: mata o servidor
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
```

- [ ] **Step 2: Testar o `iniciar.bat`**

Dar duplo clique no `iniciar.bat`. Verificar:
- Exibe o IP da máquina na rede (ex: `192.168.1.X`)
- Servidor sobe sem erros
- Abrindo `http://IP_EXIBIDO:3001` em outro dispositivo na mesma rede carrega a aplicação

- [ ] **Step 3: Commit e push final**

```bash
cd C:\vscode\ado
git add iniciar.bat
git commit -m "feat: iniciar.bat exibe IP da rede e libera firewall"
git push
```

---

## Resumo do que muda

| Arquivo | Mudança |
|---|---|
| `sap-mcp-server/api-server.js` | Escuta em `0.0.0.0`, serve HTML em `GET /`, exibe IP no console |
| `iteracoes_ado.html` | Remove `http://localhost:3001` de todas as chamadas fetch (8 ocorrências) |
| `iniciar.bat` | Detecta IP, libera firewall, exibe URL para compartilhar |
