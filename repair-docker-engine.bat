@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo Docker Engine automatic repair
echo This keeps Docker images, containers, volumes, and project data.
echo Windows will ask for administrator approval once.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\repair-docker-engine.ps1"
set "RESULT=%ERRORLEVEL%"

echo.
if "%RESULT%"=="0" (
  echo Docker Engine is ready.
) else if "%RESULT%"=="10" (
  echo Windows must be restarted. After restart, run this file once more.
) else (
  echo Docker repair did not complete. A diagnostic report was saved in outputs.
)

echo.
pause
exit /b %RESULT%
