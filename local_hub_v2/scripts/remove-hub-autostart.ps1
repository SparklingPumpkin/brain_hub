param()

$ErrorActionPreference = 'Stop'

$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'Local Hub V2.lnk'

if (Test-Path $shortcutPath) {
  Remove-Item $shortcutPath -Force
  Write-Host "Auto-start removed: $shortcutPath"
} else {
  Write-Host 'No Local Hub auto-start shortcut was found.'
}
