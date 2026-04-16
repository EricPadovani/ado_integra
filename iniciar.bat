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
