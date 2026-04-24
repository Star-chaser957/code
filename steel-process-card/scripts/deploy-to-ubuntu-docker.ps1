param(
  [string]$ServerHost = '192.168.1.161',
  [string]$Username = 'xh',
  [Parameter(Mandatory = $true)]
  [string]$Password,
  [string]$RemoteAppDir = '/home/xh/apps/steel-process-card',
  [string]$ImageName = 'steel-process-card-app:latest'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceArchive = Join-Path ([System.IO.Path]::GetTempPath()) 'steel-process-card-deploy-current.tgz'
$imageArchive = Join-Path ([System.IO.Path]::GetTempPath()) 'steel-process-card-app-current.tar'
$remoteSourceArchive = '/tmp/steel-process-card-deploy-current.tgz'
$remoteImageArchive = '/tmp/steel-process-card-app-current.tar'
$remoteScriptPath = "$RemoteAppDir/deploy/redeploy-app.sh"
$hostKey = 'ssh-ed25519 255 SHA256:k8fz5wkdrS309cOe/SPEjLB5g72rHAO1Jbc6MT8xg5E'

$plink = (Get-Command plink.exe -ErrorAction Stop).Source
$pscp = (Get-Command pscp.exe -ErrorAction Stop).Source
$null = Get-Command docker -ErrorAction Stop
$null = Get-Command tar -ErrorAction Stop

Write-Host "Building Docker image $ImageName ..." -ForegroundColor Cyan
docker build -t $ImageName $projectRoot

if (Test-Path $sourceArchive) {
  Remove-Item $sourceArchive -Force
}

if (Test-Path $imageArchive) {
  Remove-Item $imageArchive -Force
}

Write-Host 'Packing source archive ...' -ForegroundColor Cyan
tar -czf $sourceArchive `
  --exclude='.git' `
  --exclude='node_modules' `
  --exclude='dist' `
  --exclude='server/data/*.sqlite' `
  --exclude='deploy/.env.docker' `
  --exclude='deploy/process_card.dump' `
  -C $projectRoot .

Write-Host 'Packing Docker image archive ...' -ForegroundColor Cyan
docker save -o $imageArchive $ImageName

Write-Host "Uploading archives to $ServerHost ..." -ForegroundColor Cyan
& $pscp -batch -hostkey $hostKey -pw $Password $sourceArchive "$Username@${ServerHost}:$remoteSourceArchive"
& $pscp -batch -hostkey $hostKey -pw $Password $imageArchive "$Username@${ServerHost}:$remoteImageArchive"
& $pscp -batch -hostkey $hostKey -pw $Password (Join-Path $projectRoot 'deploy\redeploy-app.sh') "$Username@${ServerHost}:$remoteScriptPath"

$remoteCommand = @"
chmod +x '$remoteScriptPath'
APP_DIR='$RemoteAppDir' /bin/bash '$remoteScriptPath' '$remoteSourceArchive' '$remoteImageArchive'
"@

Write-Host 'Running remote redeploy ...' -ForegroundColor Cyan
& $plink -batch -hostkey $hostKey -pw $Password "$Username@$ServerHost" $remoteCommand

Write-Host "Deployment finished: http://$ServerHost/" -ForegroundColor Green
