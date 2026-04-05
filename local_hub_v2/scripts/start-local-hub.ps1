param(
  [switch]$Foreground
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'hub.pid'
$stdoutLog = Join-Path $runtimeDir 'hub.stdout.log'
$stderrLog = Join-Path $runtimeDir 'hub.stderr.log'
$nodeExe = (Get-Command node -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Test-HubHealth {
  try {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -Method Get -TimeoutSec 2
    return ($response.ok -eq $true)
  } catch {
    return $false
  }
}

function Get-HubProcess {
  if (Test-Path $pidFile) {
    $pidText = Get-Content -Raw $pidFile
    $candidatePid = 0
    if ([int]::TryParse($pidText.Trim(), [ref]$candidatePid)) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $candidatePid" -ErrorAction SilentlyContinue
      if ($process -and $process.CommandLine -like '*src/server.js*') {
        return $process
      }
    }
  }

  $tcp = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
  if ($tcp) {
    foreach ($entry in $tcp) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.OwningProcess)" -ErrorAction SilentlyContinue
      if ($process -and $process.CommandLine -like '*src/server.js*') {
        return $process
      }
    }
  }

  return $null
}

$existing = Get-HubProcess
if ($existing) {
  Write-Host "Local Hub is already running (PID $($existing.ProcessId))."
  Write-Host "Health: $(if (Test-HubHealth) { 'ok' } else { 'unreachable' })"
  exit 0
}

if ($Foreground) {
  Write-Host "Starting Local Hub in foreground..."
  & $nodeExe 'src/server.js'
  exit $LASTEXITCODE
}

if (Test-Path $stdoutLog) { Remove-Item $stdoutLog -Force }
if (Test-Path $stderrLog) { Remove-Item $stderrLog -Force }

$process = Start-Process `
  -FilePath $nodeExe `
  -ArgumentList 'src/server.js' `
  -WorkingDirectory $projectRoot `
  -PassThru `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden

$process.Id | Set-Content -Path $pidFile -Encoding ascii

$healthy = $false
for ($i = 0; $i -lt 20; $i += 1) {
  Start-Sleep -Milliseconds 500
  if (Test-HubHealth) {
    $healthy = $true
    break
  }
}

if (-not $healthy) {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  throw "Local Hub failed to pass health check. Check $stdoutLog and $stderrLog."
}

Write-Host "Local Hub started."
Write-Host "PID: $($process.Id)"
Write-Host "Health: http://127.0.0.1:8765/health"
Write-Host "Logs:"
Write-Host "  $stdoutLog"
Write-Host "  $stderrLog"
