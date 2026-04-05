param()

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'hub.pid'

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

$process = Get-HubProcess
if (-not $process) {
  Write-Host 'Local Hub is not running.'
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  exit 0
}

Stop-Process -Id $process.ProcessId -Force
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Local Hub stopped (PID $($process.ProcessId))."
