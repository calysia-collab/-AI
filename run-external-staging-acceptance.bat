@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-external-staging-acceptance.ps1"
if errorlevel 1 (
  echo.
  echo External staging acceptance failed. Review the output above.
  pause
  exit /b 1
)

echo.
echo External staging acceptance completed successfully.
pause
