@echo off
title NexoHub Servidor Web Completo (Rust Axum + Frontend SPA)
echo ===================================================
echo   NexoHub - Servidor Web de Producao Local
echo   (Binario Rust Axum nativo + Frontend compilado)
echo ===================================================
cd /d "%~dp0"

echo [1/3] Compilando frontend para distribuicao web...
call pnpm build:web
if %ERRORLEVEL% neq 0 (
    echo Erro ao compilar frontend.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Liberando porta 8080 se necessario...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [3/3] Iniciando binario nexohub-server na porta 8080...
echo Abrindo seu navegador em http://localhost:8080 ...
start http://localhost:8080
set STATIC_DIR=apps\client\dist
set PORT=8080
set HOST=127.0.0.1
set RUST_LOG=info
cargo run --release -p nexohub-server
pause
