$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$dbFile = if ($env:SQLITE_FILE_PATH) { $env:SQLITE_FILE_PATH } else { Join-Path $rootDir 'server\data\process-cards.sqlite' }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $rootDir 'backups' }
$retentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if (-not (Test-Path $dbFile)) {
  throw "Database file not found: $dbFile"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$targetFile = Join-Path $backupDir "process-cards-$stamp.sqlite"
Copy-Item -LiteralPath $dbFile -Destination $targetFile -Force

Get-ChildItem -Path $backupDir -Filter 'process-cards-*.sqlite' -File |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) } |
  Remove-Item -Force

Write-Output "Backup created: $targetFile"
