@echo off
title Git — Salvar alteracoes
cd /d "%~dp0"

echo.
echo ============================================
echo   Salvar alteracoes no GitHub
echo ============================================
echo.

git status --short
echo.

set /p MSG="Descricao do que foi alterado: "
if "%MSG%"=="" (
    echo [ERRO] Descricao nao pode ser vazia.
    pause
    exit /b 1
)

git add .
git commit -m "%MSG%"
git push

echo.
echo ============================================
echo   Alteracoes salvas com sucesso!
echo ============================================
echo.
pause
