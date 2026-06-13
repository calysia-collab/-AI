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
if errorlevel 1 goto :failed
"%NODE_BIN%" "%~dp0scripts\verify-migrations.mjs"
if errorlevel 1 goto :failed

for %%F in (
  app.js
  core.js
  data\daily-quote.js
  data\weekly-insights.js
  server.mjs
  service-worker.js
  api\auth.mjs
  api\security.mjs
  api\production-readiness.mjs
  api\data-protection.mjs
  api\attachment-storage.mjs
  api\protected-records.mjs
  api\database.mjs
  api\database-factory.mjs
  api\postgresql-database.mjs
  api\handler.mjs
  api\validation.mjs
  database\migrate-postgresql.mjs
  scripts\runtime-security.mjs
  scripts\check-runtime.mjs
  scripts\audit-data-protection.mjs
  scripts\backup.mjs
  scripts\verify-backup.mjs
  scripts\restore-backup.mjs
  scripts\recover-account.mjs
  scripts\migrate-postgresql.mjs
  scripts\migrate-sqlite-to-postgresql.mjs
  scripts\test-postgresql-integration.mjs
  scripts\verify-migrations.mjs
  scripts\bootstrap-owner.mjs
  scripts\validate-production-environment.mjs
  scripts\test-backup-restore-drill.mjs
  scripts\test-key-rotation-drill.mjs
  scripts\test-clamav-integration.mjs
  scripts\test-staging-endpoint.mjs
) do (
  "%NODE_BIN%" --check "%~dp0%%F"
  if errorlevel 1 goto :failed
)

pushd "%~dp0"
"%NODE_BIN%" --no-warnings --test tests\core.test.mjs tests\security.test.mjs tests\data-protection.test.mjs tests\attachment-storage.test.mjs tests\auth.test.mjs tests\database.test.mjs tests\recovery.test.mjs tests\postgresql.test.mjs tests\server.test.mjs tests\source-security.test.mjs
set "TEST_EXIT=%ERRORLEVEL%"
popd
if not "%TEST_EXIT%"=="0" goto :failed

echo.
echo Verification passed.
pause
exit /b 0

:failed
echo.
echo Verification failed. Review the output above.
pause
exit /b 1
