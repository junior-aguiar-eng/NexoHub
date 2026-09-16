@echo off
title NexoHub Desktop
echo ===================================================
echo   Iniciando NexoHub Desktop (Tauri + Rust)
echo ===================================================
cd /d "%~dp0"

echo [1/2] Garantindo portas de conexao liberadas...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5180 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [2/2] Inicializando janela nativa do aplicativo...
pnpm dev:desktop
pause
