@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-rc-git-release.ps1"
if errorlevel 1 (
  echo.
  echo RC git release failed. Review the output above.
  pause
  exit /b 1
)

echo.
echo RC git release completed successfully.
pause
