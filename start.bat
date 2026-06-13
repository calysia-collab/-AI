@echo off
setlocal
set "NODE_BIN=node"

where node >nul 2>nul
if not errorlevel 1 goto :node_ready
set "NODE_BIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_BIN%" goto :node_ready
echo Node.js 24.14.x is required.
pause
exit /b 1

:node_ready
"%NODE_BIN%" "%~dp0scripts\check-runtime.mjs"
if errorlevel 1 (
  pause
  exit /b 1
)

start "Sasha Insurance Workbench" /min "%NODE_BIN%" "%~dp0server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
