$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $root "deploy\staging\compose.yml"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportDirectory = Join-Path $root "outputs\staging-validation-$timestamp"

function New-RandomHex([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return ([BitConverter]::ToString($buffer) -replace "-", "").ToLowerInvariant()
}

function New-RandomBase64([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($buffer)
}

function Invoke-External([string]$file, [string[]]$arguments) {
  & $file @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$file exited with code $LASTEXITCODE."
  }
}

function Invoke-ComposeDown {
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $downOutput = & docker compose -f $composeFile down --volumes --remove-orphans 2>&1
    $downExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  if ($downExitCode -ne 0) {
    $downOutput | Set-Content (
      Join-Path $reportDirectory "compose-down-error.log"
    ) -Encoding utf8
    throw "Docker Compose cleanup failed with code $downExitCode."
  }
}

function Initialize-LocalDockerConfig {
  if ($env:DOCKER_CONFIG) {
    return
  }
  $dockerConfig = Join-Path $root ".tmp-docker-config"
  New-Item -ItemType Directory -Path $dockerConfig -Force | Out-Null
  New-Item -ItemType Directory -Path (
    Join-Path $dockerConfig "buildx\instances"
  ) -Force | Out-Null
  $configPath = Join-Path $dockerConfig "config.json"
  if (-not (Test-Path $configPath)) {
    "{}" | Set-Content $configPath -Encoding ascii
  }
  $env:DOCKER_CONFIG = $dockerConfig
}

Initialize-LocalDockerConfig
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null

$env:SASHA_STAGING_POSTGRES_PASSWORD = New-RandomHex 18
$env:SASHA_STAGING_PASSWORD = "Sasha$(New-RandomHex 12)A1!"
$env:SASHA_STAGING_MASTER_KEY = New-RandomBase64 32
$env:SASHA_STAGING_DATA_KEY = New-RandomBase64 32
$env:SASHA_CLAMAV_IMAGE_TAG = "1.4"

$result = [ordered]@{
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = "running"
  checks = [ordered]@{}
}

Push-Location $root
try {
  Invoke-ComposeDown
  $result.checks.composePreflightCleanup = "passed"

  Invoke-External "docker" @(
    "build", "--target", "verification",
    "--tag", "sasha-workbench-verification:$timestamp", "."
  )
  $result.checks.npmCiAuditAndReleaseTests = "passed"

  Invoke-External "docker" @(
    "compose", "-f", $composeFile, "config", "--quiet"
  )
  $result.checks.composeConfiguration = "passed"

  $composeUpReportPath = Join-Path $reportDirectory "compose-up.log"
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $composeUpOutput = & docker compose -f $composeFile `
      up --build --detach --force-recreate --renew-anon-volumes 2>&1
    $composeUpExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  $composeUpOutput | Set-Content $composeUpReportPath -Encoding utf8
  if ($composeUpExitCode -ne 0) {
    throw "Docker Compose startup failed with code $composeUpExitCode."
  }

  Invoke-External "docker" @(
    "compose", "-f", $composeFile, "exec", "-T", "app",
    "node", "scripts/test-postgresql-integration.mjs"
  )
  $result.checks.postgresqlMigrationsEncryptionRotation = "passed"

  Invoke-External "docker" @(
    "compose", "-f", $composeFile, "exec", "-T", "app",
    "node", "scripts/test-phase2-postgresql-scale.mjs"
  )
  $result.checks.postgresql100kPhase2Scale = "passed"

  Invoke-External "docker" @(
    "compose", "-f", $composeFile, "exec", "-T", "app",
    "node", "scripts/test-clamav-integration.mjs"
  )
  $result.checks.clamavCleanAndEicar = "passed"

  $endpointReportPath = Join-Path $reportDirectory "staging-endpoint-report.log"
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $endpointOutput = & docker compose -f $composeFile exec -T `
      -e "SASHA_STAGING_BASE_URL=https://proxy" `
      -e "SASHA_STAGING_ALLOW_SELF_SIGNED=true" `
      -e "SASHA_STAGING_INTERNAL_NETWORK=true" `
      -e "SASHA_STAGING_USERNAME=staging.manager" `
      app node scripts/test-staging-endpoint.mjs 2>&1
    $endpointExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  $endpointOutput | Set-Content $endpointReportPath -Encoding utf8
  if ($endpointExitCode -ne 0) {
    throw "Staging endpoint validation failed with code $endpointExitCode."
  }
  $result.checks.httpsCookieLoginAndAttachments = "passed"
  $result.checks.phase2SchemaAndVersionedApi = "passed"
  $result.checks.phase2AutomationAndPhase3Ocr = "passed"

  $auditOutput = & docker compose -f $composeFile exec -T app `
    node scripts/audit-data-protection.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "Data protection audit failed with code $LASTEXITCODE."
  }
  $auditOutput | Set-Content (
    Join-Path $reportDirectory "data-protection-report.json"
  ) -Encoding utf8
  $result.checks.dataProtectionAudit = "passed"

  Invoke-External "docker" @(
    "compose", "-f", $composeFile, "exec", "-T", "postgres",
    "sh", "-ec",
    "pg_dump -U sasha -d sasha --format=custom -f /tmp/staging.dump; " +
    "dropdb -U sasha --if-exists sasha_restore; " +
    "createdb -U sasha sasha_restore; " +
    "pg_restore -U sasha -d sasha_restore --exit-on-error /tmp/staging.dump; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM users') -ge 1; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM attachments') -ge 1; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM import_jobs') -ge 1; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM search_tokens') -ge 1; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM ocr_jobs') -ge 1; " +
    "test `$(psql -U sasha -d sasha_restore -Atc 'SELECT count(*) FROM ocr_corrections') -ge 1; " +
    "rm -f /tmp/staging.dump"
  )
  $result.checks.postgresqlDumpRestore = "passed"

  $result.status = "passed"
} catch {
  $result.status = "failed"
  $result.error = $_.Exception.Message
  throw
} finally {
  $result.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $result | ConvertTo-Json -Depth 5 | Set-Content (
    Join-Path $reportDirectory "summary.json"
  ) -Encoding utf8

  $cleanupErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & docker compose -f $composeFile logs --no-color *> (
      Join-Path $reportDirectory "services.log"
    )
    & docker compose -f $composeFile down --volumes --remove-orphans
  } finally {
    $ErrorActionPreference = $cleanupErrorPreference
  }
  Pop-Location

  Remove-Item Env:SASHA_STAGING_POSTGRES_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SASHA_STAGING_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SASHA_STAGING_MASTER_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:SASHA_STAGING_DATA_KEY -ErrorAction SilentlyContinue
}

Write-Output "Staging validation passed."
Write-Output "Report: $reportDirectory"
