param(
  [switch]$AdminPhase,
  [string]$ReportDirectory,
  [switch]$DiagnoseOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($ReportDirectory)) {
  $ReportDirectory = Join-Path $root "outputs\docker-repair-$timestamp"
}

New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
$logPath = Join-Path $ReportDirectory "repair.log"

function Write-RepairLog([string]$message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line -Encoding utf8
}

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

function Save-CommandOutput(
  [string]$title,
  [scriptblock]$command,
  [string]$path
) {
  Add-Content -LiteralPath $path -Value "`r`n=== $title ===" -Encoding utf8
  try {
    $output = & $command 2>&1 | Out-String
    Add-Content -LiteralPath $path -Value $output -Encoding utf8
  } catch {
    Add-Content -LiteralPath $path -Value $_.Exception.Message -Encoding utf8
  }
}

function Get-MemorySnapshot {
  $totalMb = 0
  try {
    $totalMb = [math]::Round(
      (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB
    )
  } catch {
    $sample = Get-Counter "\NUMA Node Memory(*)\Total MBytes" |
      ForEach-Object CounterSamples |
      Where-Object { $_.InstanceName -eq "_Total" } |
      Select-Object -First 1
    if ($null -ne $sample) {
      $totalMb = [math]::Round($sample.CookedValue)
    }
  }

  $counters = Get-Counter `
    "\Memory\Available MBytes", `
    "\Memory\% Committed Bytes In Use"
  $available = $counters.CounterSamples |
    Where-Object { $_.Path -like "*available mbytes" } |
    Select-Object -First 1
  $committed = $counters.CounterSamples |
    Where-Object { $_.Path -like "*committed bytes in use" } |
    Select-Object -First 1

  return [ordered]@{
    totalMb = $totalMb
    availableMb = [math]::Round($available.CookedValue)
    committedPercent = [math]::Round($committed.CookedValue, 1)
  }
}

function Save-Diagnostics([string]$stage) {
  $path = Join-Path $ReportDirectory "diagnostics-$stage.txt"
  Save-CommandOutput "Windows" {
    $windows = Get-ItemProperty `
      "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
    [pscustomobject]@{
      productName = $windows.ProductName
      displayVersion = $windows.DisplayVersion
      build = "$($windows.CurrentBuild).$($windows.UBR)"
      processorCount = $env:NUMBER_OF_PROCESSORS
    }
  } $path
  Save-CommandOutput "Memory" {
    Get-MemorySnapshot | ConvertTo-Json
  } $path
  Save-CommandOutput "Largest processes" {
    Get-Process |
      Sort-Object WorkingSet64 -Descending |
      Select-Object -First 15 ProcessName, Id,
        @{n = "WorkingSetMB"; e = {[math]::Round($_.WorkingSet64 / 1MB)}},
        @{n = "PrivateMB"; e = {[math]::Round($_.PrivateMemorySize64 / 1MB)}}
  } $path
  Save-CommandOutput "Docker version" {
    docker version
  } $path
  Save-CommandOutput "Docker Desktop status" {
    docker desktop status
  } $path
  Save-CommandOutput "WSL version" {
    wsl --version
  } $path
  Save-CommandOutput "WSL distributions" {
    wsl --list --verbose
  } $path
  Save-CommandOutput "Services" {
    Get-Service WslService, vmcompute, hns, com.docker.service, LanmanServer `
      -ErrorAction SilentlyContinue |
      Select-Object Name, Status, StartType
  } $path
}

function Stop-DockerStack {
  Write-RepairLog "Stopping the stalled Docker Desktop processes."
  $processNames = @(
    "Docker Desktop",
    "com.docker.backend",
    "com.docker.build",
    "com.docker.proxy",
    "vpnkit",
    "dockerd"
  )

  foreach ($name in $processNames) {
    Get-Process -Name $name -ErrorAction SilentlyContinue |
      Stop-Process -Force -ErrorAction SilentlyContinue
  }

  Start-Sleep -Seconds 3
  Write-RepairLog "Shutting down the WSL virtual machine."
  & wsl --shutdown 2>&1 |
    Add-Content -LiteralPath $logPath -Encoding utf8
  Start-Sleep -Seconds 5
}

function Set-ConservativeWslResources([int]$totalMemoryMb) {
  if ($totalMemoryMb -lt 7500) {
    throw "Docker Desktop requires at least 8 GB of system RAM."
  }

  $memoryGb = if ($totalMemoryMb -lt 10000) {
    3
  } elseif ($totalMemoryMb -lt 15000) {
    4
  } else {
    6
  }
  $processors = if ($env:NUMBER_OF_PROCESSORS -gt 2) { 2 } else { 1 }
  $configPath = Join-Path $env:USERPROFILE ".wslconfig"
  $backupPath = Join-Path $ReportDirectory "wslconfig-before.txt"
  $original = ""

  if (Test-Path -LiteralPath $configPath) {
    Copy-Item -LiteralPath $configPath -Destination $backupPath -Force
    $original = Get-Content -LiteralPath $configPath -Raw
  }

  $lines = @()
  if (-not [string]::IsNullOrWhiteSpace($original)) {
    $lines = @($original -split "\r?\n")
  }

  $hasWsl2 = $false
  $insideWsl2 = $false
  $settingsWritten = $false
  $result = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -match "^\s*\[wsl2\]\s*$") {
      $hasWsl2 = $true
      $insideWsl2 = $true
      $result.Add($line)
      continue
    }

    if ($line -match "^\s*\[.+\]\s*$" -and $insideWsl2) {
      if (-not $settingsWritten) {
        $result.Add("memory=${memoryGb}GB")
        $result.Add("processors=$processors")
        $result.Add("swap=2GB")
        $settingsWritten = $true
      }
      $insideWsl2 = $false
    }

    if (
      $insideWsl2 -and
      $line -match "^\s*(memory|processors|swap)\s*="
    ) {
      continue
    }

    $result.Add($line)
  }

  if ($insideWsl2 -and -not $settingsWritten) {
    $result.Add("memory=${memoryGb}GB")
    $result.Add("processors=$processors")
    $result.Add("swap=2GB")
    $settingsWritten = $true
  }

  if (-not $hasWsl2) {
    if ($result.Count -gt 0 -and $result[$result.Count - 1] -ne "") {
      $result.Add("")
    }
    $result.Add("[wsl2]")
    $result.Add("memory=${memoryGb}GB")
    $result.Add("processors=$processors")
    $result.Add("swap=2GB")
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText(
    $configPath,
    (($result -join "`r`n").TrimEnd() + "`r`n"),
    $utf8NoBom
  )
  Write-RepairLog "WSL resources set to ${memoryGb} GB RAM and 2 GB swap."
}

function Invoke-AdminRepair {
  if (-not (Test-Administrator)) {
    throw "The system repair phase requires administrator permission."
  }

  Write-RepairLog "Checking required Windows features."
  $restartRequired = $false
  $features = @(
    "Microsoft-Windows-Subsystem-Linux",
    "VirtualMachinePlatform"
  )

  foreach ($featureName in $features) {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName $featureName
    if ($feature.State -eq "Disabled") {
      Enable-WindowsOptionalFeature -Online -FeatureName $featureName `
        -All -NoRestart | Out-Null
      $restartRequired = $true
      Write-RepairLog "Enabled Windows feature: $featureName"
    }
  }

  Write-RepairLog "Starting Windows virtualization and networking services."
  Set-Service -Name LanmanServer -StartupType Automatic
  Start-Service -Name LanmanServer

  $wslService = Get-Service -Name WslService -ErrorAction SilentlyContinue
  if ($null -ne $wslService) {
    Restart-Service -Name WslService -Force
  }

  foreach ($serviceName in @("vmcompute", "hns", "com.docker.service")) {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($null -ne $service -and $service.Status -ne "Running") {
      try {
        Start-Service -Name $serviceName
      } catch {
        Write-RepairLog (
          "Service $serviceName could not be started yet: " +
          $_.Exception.Message
        )
      }
    }
  }

  if ($restartRequired) {
    Set-Content -LiteralPath (
      Join-Path $ReportDirectory "reboot-required.txt"
    ) -Value "Windows features were enabled. Restart Windows, then run the repair again."
    exit 10
  }
}

function Invoke-AdminPhase {
  $powerShell = Join-Path $PSHOME "powershell.exe"
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`"",
    "-AdminPhase",
    "-ReportDirectory", "`"$ReportDirectory`""
  )

  Write-RepairLog "Requesting administrator permission for Windows services."
  try {
    $process = Start-Process -FilePath $powerShell -Verb RunAs `
      -ArgumentList $arguments -Wait -PassThru
    return $process.ExitCode
  } catch {
    Write-RepairLog "Administrator permission was not granted."
    return 1223
  }
}

function Start-DockerDesktop {
  $desktopPath = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $desktopPath)) {
    throw "Docker Desktop is not installed in the expected location."
  }

  Write-RepairLog "Starting Docker Desktop."
  Start-Process -FilePath $desktopPath | Out-Null
}

function Wait-DockerEngine([int]$timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  $nextProgress = Get-Date

  while ((Get-Date) -lt $deadline) {
    $serverVersion = & docker info --format "{{.ServerVersion}}" 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($serverVersion)) {
      Write-RepairLog "Docker Engine is ready (server $serverVersion)."
      return $true
    }

    if ((Get-Date) -ge $nextProgress) {
      $remaining = [math]::Max(
        0,
        [math]::Round(($deadline - (Get-Date)).TotalSeconds)
      )
      Write-Host "Waiting for Docker Engine... $remaining seconds remaining."
      $nextProgress = (Get-Date).AddSeconds(20)
    }
    Start-Sleep -Seconds 5
  }

  return $false
}

function Reset-DockerDesktopPreferences {
  $settingsPath = Join-Path $env:APPDATA "Docker\settings-store.json"
  if (-not (Test-Path -LiteralPath $settingsPath)) {
    return
  }

  $backupName = "settings-store-before-$timestamp.json"
  Copy-Item -LiteralPath $settingsPath `
    -Destination (Join-Path $ReportDirectory $backupName) -Force
  Move-Item -LiteralPath $settingsPath `
    -Destination "$settingsPath.repair-$timestamp.bak" -Force
  Write-RepairLog (
    "Rebuilt Docker Desktop preferences; the previous file was backed up."
  )
}

function Save-DockerLogTails {
  $hostLogDirectory = Join-Path $env:LOCALAPPDATA "Docker\log\host"
  $target = Join-Path $ReportDirectory "docker-log-tail.txt"
  if (-not (Test-Path -LiteralPath $hostLogDirectory)) {
    return
  }

  Get-ChildItem -LiteralPath $hostLogDirectory -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 6 |
    ForEach-Object {
      Add-Content -LiteralPath $target `
        -Value "`r`n=== $($_.Name) ===" -Encoding utf8
      Get-Content -LiteralPath $_.FullName -Tail 250 -ErrorAction SilentlyContinue |
        Add-Content -LiteralPath $target -Encoding utf8
    }
}

function Save-OfficialDockerDiagnostics {
  $diagnose = Join-Path $env:ProgramFiles `
    "Docker\Docker\resources\com.docker.diagnose.exe"
  if (-not (Test-Path -LiteralPath $diagnose)) {
    return
  }

  $outputPath = Join-Path $ReportDirectory "docker-diagnose.txt"
  $errorPath = Join-Path $ReportDirectory "docker-diagnose-error.txt"
  Write-RepairLog "Running Docker's official diagnostic check."
  try {
    $process = Start-Process -FilePath $diagnose -ArgumentList "check" `
      -RedirectStandardOutput $outputPath `
      -RedirectStandardError $errorPath `
      -PassThru
    if (-not $process.WaitForExit(120000)) {
      $process.Kill()
      Add-Content -LiteralPath $outputPath `
        -Value "Diagnostic check timed out after 120 seconds." -Encoding utf8
    }
  } catch {
    Add-Content -LiteralPath $outputPath `
      -Value $_.Exception.Message -Encoding utf8
  }
}

if ($AdminPhase) {
  Invoke-AdminRepair
  exit 0
}

$summary = [ordered]@{
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = "running"
  probableCause = @(
    "Docker backend exhausted memory while creating the WSL engine.",
    "The host has 8 GB RAM, Docker's documented minimum."
  )
  reportDirectory = $ReportDirectory
}

try {
  Write-RepairLog "Collecting the initial Docker and Windows diagnostics."
  Save-Diagnostics "before"
  $summary.memoryBefore = Get-MemorySnapshot

  if ($DiagnoseOnly) {
    $summary.status = "diagnosed"
    Write-RepairLog "Diagnosis completed without making changes."
    exit 0
  }

  Stop-DockerStack
  Set-ConservativeWslResources $summary.memoryBefore.totalMb
  $summary.memoryAfterStop = Get-MemorySnapshot

  $adminExitCode = Invoke-AdminPhase
  if ($adminExitCode -eq 10) {
    $summary.status = "reboot-required"
    Write-RepairLog "A Windows restart is required before Docker can start."
    exit 10
  }
  if ($adminExitCode -ne 0) {
    throw "Windows service repair failed with exit code $adminExitCode."
  }

  Start-DockerDesktop
  $ready = Wait-DockerEngine 240

  if (-not $ready) {
    Write-RepairLog (
      "The first start did not complete. Starting the safe preference repair."
    )
    Stop-DockerStack
    Reset-DockerDesktopPreferences
    Start-DockerDesktop
    $ready = Wait-DockerEngine 240
  }

  if (-not $ready) {
    throw "Docker Engine did not become ready after both safe repair attempts."
  }

  $summary.status = "passed"
  $summary.serverVersion = (& docker info --format "{{.ServerVersion}}")
  $summary.memoryAfterStart = Get-MemorySnapshot
  Save-Diagnostics "after"
  Write-RepairLog "Docker Engine repair and verification passed."
} catch {
  $summary.status = "failed"
  $summary.error = $_.Exception.Message
  Write-RepairLog "Repair failed: $($_.Exception.Message)"
  Save-DockerLogTails
  Save-OfficialDockerDiagnostics
  Save-Diagnostics "failed"
  exit 1
} finally {
  $summary.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $summary | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (
      Join-Path $ReportDirectory "summary.json"
    ) -Encoding utf8
}

exit 0
