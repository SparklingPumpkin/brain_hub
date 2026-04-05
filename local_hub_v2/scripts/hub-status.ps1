param()

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'hub.pid'

$health = $null
$healthError = $null

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -Method Get -TimeoutSec 2
} catch {
  $healthError = $_.Exception.Message
}

$process = $null
if (Test-Path $pidFile) {
  $pidText = Get-Content -Raw $pidFile
  $candidatePid = 0
  if ([int]::TryParse($pidText.Trim(), [ref]$candidatePid)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $candidatePid" -ErrorAction SilentlyContinue
  }
}

[PSCustomObject]@{
  running = ($health -and $health.ok -eq $true)
  health = $health
  healthError = $healthError
  pid = if ($process) { $process.ProcessId } else { $null }
  commandLine = if ($process) { $process.CommandLine } else { $null }
} | Format-List
