param(
  [string]$RcName = "v1.0.0-rc1",
  [string]$RemoteUrl = "https://github.com/calysia-collab/-AI.git",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $root "outputs\rc-git-release-$timestamp"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$summary = [ordered]@{
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = "running"
  rcName = $RcName
  branch = "main"
  outputDirectory = $outputDir
  checks = [ordered]@{}
}

function Write-Summary {
  $summary.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $outputDir "summary.json") -Encoding UTF8
}

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $logPath = Join-Path $outputDir "$Name.log"
  $summary.checks[$Name] = "running"
  Write-Summary
  Write-Host ""
  Write-Host "== git $($Arguments -join ' ') =="

  Push-Location $root
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & git @Arguments 2>&1 | ForEach-Object {
      $_.ToString()
    } | Tee-Object -FilePath $logPath
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
  }

  if ($exitCode -ne 0) {
    $summary.checks[$Name] = "failed"
    $summary.status = "failed"
    Write-Summary
    throw "git $($Arguments -join ' ') failed with code $exitCode."
  }

  $summary.checks[$Name] = "passed"
  Write-Summary
}

function Read-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  Push-Location $root
  try {
    $output = & git @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return ""
    }
    return ($output -join "`n").Trim()
  } finally {
    Pop-Location
  }
}

try {
  $safeDirectory = $root.Path.Replace("\", "/")
  Invoke-Git "safe-directory" @("config", "--global", "--add", "safe.directory", $safeDirectory)

  $remote = Read-Git @("remote", "get-url", "origin")
  if ([string]::IsNullOrWhiteSpace($remote)) {
    Invoke-Git "remote-add-origin" @("remote", "add", "origin", $RemoteUrl)
  } else {
    $summary["remote"] = $remote
  }

  Invoke-Git "branch-main" @("branch", "-M", "main")
  Invoke-Git "stage-all" @("add", ".")

  $staged = Read-Git @("diff", "--cached", "--name-only")
  if ([string]::IsNullOrWhiteSpace($staged)) {
    $summary.checks["commit"] = "skipped_no_changes"
  } else {
    Invoke-Git "commit" @("commit", "-m", "Release candidate $RcName")
  }

  $existingTag = Read-Git @("tag", "--list", $RcName)
  if ([string]::IsNullOrWhiteSpace($existingTag)) {
    Invoke-Git "tag" @("tag", "-a", $RcName, "-m", "莎莎保險助理工作台 $RcName")
  } else {
    $summary.checks["tag"] = "skipped_exists"
  }

  if ($NoPush) {
    $summary.checks["push"] = "skipped"
  } else {
    Invoke-Git "push-main" @("push", "-u", "origin", "main")
    Invoke-Git "push-tag" @("push", "origin", $RcName)
  }

  $summary.status = "passed"
  $summary["commit"] = Read-Git @("rev-parse", "--short", "HEAD")
  Write-Summary
  Write-Host ""
  Write-Host "RC git release completed."
  Write-Host "Report: $outputDir"
} catch {
  if ($summary.status -eq "running") {
    $summary.status = "failed"
    Write-Summary
  }
  Write-Error $_
  exit 1
}
