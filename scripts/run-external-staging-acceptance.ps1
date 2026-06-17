$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $root "outputs\external-staging-acceptance-$timestamp"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$summary = [ordered]@{
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = "running"
  outputDirectory = $outputDir
  checks = [ordered]@{}
  missingEnvironment = @()
}

function Write-Summary {
  $summary.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $outputDir "summary.json") -Encoding UTF8
}

function Assert-Environment {
  $required = @(
    "SASHA_PUBLIC_URL",
    "SASHA_DATABASE_URL",
    "SASHA_DATABASE_SSL",
    "SASHA_TEST_DATABASE_URL",
    "SASHA_MASTER_KEY",
    "SASHA_DATA_KEY_ID",
    "SASHA_DATA_KEYS",
    "SASHA_COOKIE_SECURE",
    "SASHA_TRUST_PROXY",
    "SASHA_CLAMD_HOST",
    "SASHA_OCR_PROVIDER",
    "SASHA_OCR_ENDPOINT",
    "SASHA_OCR_API_KEY",
    "SASHA_STAGING_BASE_URL",
    "SASHA_STAGING_USERNAME",
    "SASHA_STAGING_PASSWORD"
  )

  $missing = @()
  foreach ($name in $required) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) {
      $missing += $name
    }
  }

  if ($missing.Count -gt 0) {
    $summary.status = "blocked"
    $summary.missingEnvironment = $missing
    Write-Summary
    throw "External staging acceptance is missing environment variables: $($missing -join ', ')"
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $logPath = Join-Path $outputDir "$Name.log"
  $summary.checks[$Name] = "running"
  Write-Summary
  Write-Host ""
  Write-Host "== $Name =="

  Push-Location $root
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $File @Arguments 2>&1 | ForEach-Object {
      $_.ToString()
    } | Tee-Object -FilePath $logPath
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
  }

  if ($null -eq $exitCode) {
    $exitCode = 0
  }

  if ($exitCode -ne 0) {
    $summary.checks[$Name] = "failed"
    $summary.status = "failed"
    Write-Summary
    throw "$Name failed with code $exitCode."
  }

  $summary.checks[$Name] = "passed"
  Write-Summary
}

try {
  Assert-Environment
  Invoke-Step "npm-ci" "npm.cmd" @("ci")
  Invoke-Step "npm-audit" "npm.cmd" @("audit", "--omit=dev", "--audit-level=high")
  Invoke-Step "production-preflight" "npm.cmd" @("run", "production:preflight")
  Invoke-Step "postgresql-migration-encryption" "npm.cmd" @("run", "postgres:test")
  Invoke-Step "clamav-clean-eicar" "npm.cmd" @("run", "staging:clamav")
  Invoke-Step "https-cookie-endpoint" "npm.cmd" @("run", "staging:endpoint")
  Invoke-Step "phase2-postgresql-scale" "npm.cmd" @("run", "phase2:postgres-scale")
  Invoke-Step "data-protection-audit" "npm.cmd" @("run", "data:protection:audit")

  $summary.status = "passed"
  Write-Summary
  Write-Host ""
  Write-Host "External staging acceptance passed."
  Write-Host "Report: $outputDir"
} catch {
  if ($summary.status -eq "running") {
    $summary.status = "failed"
    Write-Summary
  }
  Write-Error $_
  exit 1
}
