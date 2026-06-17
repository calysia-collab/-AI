@echo off
setlocal
cd /d "%~dp0"

set "DOCKER_CONFIG=%~dp0.tmp-docker-config"
if not exist "%DOCKER_CONFIG%" mkdir "%DOCKER_CONFIG%"
if not exist "%DOCKER_CONFIG%\config.json" echo {}>"%DOCKER_CONFIG%\config.json"
if not exist "%DOCKER_CONFIG%\buildx" mkdir "%DOCKER_CONFIG%\buildx"
if not exist "%DOCKER_CONFIG%\buildx\instances" mkdir "%DOCKER_CONFIG%\buildx\instances"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is required.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Start Docker Desktop and wait until it is ready, then run this file again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-staging-validation.ps1"
set "RESULT=%ERRORLEVEL%"

echo.
if "%RESULT%"=="0" (
  echo External staging validation passed.
) else (
  echo External staging validation failed. Review the output above.
)
pause
exit /b %RESULT%
