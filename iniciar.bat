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

echo [1/3] Gerando lista de iteracoes ADO...
node busca_ado.js
if errorlevel 1 (
    echo [ERRO] Falha ao gerar HTML. Verifique o arquivo .env
    pause
    exit /b 1
)

echo.
echo [2/3] Iniciando servidor SAP + IA...
start "" /B node "..\sap-mcp-server\api-server.js"
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Abrindo navegador...
start "" iteracoes_ado.html

echo.
echo ============================================
echo   Servidor rodando em http://localhost:3001
echo   Feche esta janela para encerrar o servidor
echo ============================================
echo.
pause

REM Ao fechar: mata o servidor
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
