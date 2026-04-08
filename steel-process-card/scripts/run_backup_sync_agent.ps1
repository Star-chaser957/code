$python = 'C:\Users\Administrator\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$projectRoot = 'D:\code\steel-process-card'
$scriptPath = Join-Path $projectRoot 'scripts\pull_server_backup.py'
$configPath = Join-Path $projectRoot 'scripts\pull_server_backup.local.json'
$logDir = Join-Path $projectRoot 'backups\server-postgres'
$logPath = Join-Path $logDir 'agent.log'
$mutexName = 'Global\SteelProcessCardBackupSync'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, $mutexName)
$hasHandle = $false

try {
  $hasHandle = $mutex.WaitOne(0, $false)
  if (-not $hasHandle) {
    exit 0
  }

  while ($true) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[$timestamp] Sync started" | Out-File -FilePath $logPath -Append -Encoding utf8

    & $python $scriptPath $configPath 2>&1 | Out-File -FilePath $logPath -Append -Encoding utf8

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[$timestamp] Sync finished" | Out-File -FilePath $logPath -Append -Encoding utf8
    Start-Sleep -Seconds 900
  }
} finally {
  if ($hasHandle) {
    $mutex.ReleaseMutex() | Out-Null
  }
  $mutex.Dispose()
}
