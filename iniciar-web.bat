@echo off
title NexoHub Web
echo ===================================================
echo   Iniciando NexoHub Web (Vite + React)
echo ===================================================
cd /d "%~dp0"

echo [1/2] Liberando portas anteriores se necessario...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5180 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [2/2] Iniciando servidor web de alta performance...
echo Abrindo seu navegador padrao em http://localhost:5180 ...
start http://localhost:5180
pnpm dev:web
pause
