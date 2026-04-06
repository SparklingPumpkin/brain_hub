param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$CycleId,

  [Parameter(Mandatory = $true)]
  [string]$Goal,

  # Pass multiple constraints with array syntax, e.g.
  # -Constraint @("Keep it static", "Use plain HTML and CSS only")
  [string[]]$Constraint = @(),

  [switch]$EnsureHubRunning
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$startScript = Join-Path $PSScriptRoot 'start-local-hub.ps1'

if ($EnsureHubRunning) {
  & $startScript | Out-Host
}

$constraintBlock = if ($Constraint.Count -gt 0) {
  ($Constraint | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
} else {
  "  - No additional constraints"
}

$prompt = @"
Please output exactly one fenced `context-packet` block and nothing else.

Use this content:

```context-packet
project_id: $ProjectId
cycle_id: $CycleId
stage: strategy
goal: $Goal
constraints:
$constraintBlock
next_action: codex_execute
```

Important:
- Do not add any explanation before or after the block
- Keep the field names exactly as written
- Keep the response to a single `context-packet` fenced block
"@

Set-Clipboard -Value $prompt

$chatUrl = 'https://chatgpt.com/'
$edgeCandidates = @(
  "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)

$edgePath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edgePath) {
  Start-Process -FilePath $edgePath -ArgumentList '--new-window', $chatUrl | Out-Null
} else {
  Start-Process $chatUrl | Out-Null
}

Write-Host 'ChatGPT has been opened.'
Write-Host 'The context-packet prompt has been copied to your clipboard.'
Write-Host ''
Write-Host 'Next step:'
Write-Host '1. Paste into ChatGPT'
Write-Host '2. Let ChatGPT output the fenced context-packet'
Write-Host '3. The extension will capture and send it to Local Hub'
