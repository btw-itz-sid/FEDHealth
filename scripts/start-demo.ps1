# One entry point for the local demo. Other applications are left untouched.
$ErrorActionPreference = 'Stop'
$DemoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DemoLogs = Join-Path $DemoRoot 'logs'
New-Item -ItemType Directory -Force -Path $DemoLogs | Out-Null
function Test-DemoPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(300) -and $client.Connected }
    catch { return $false }
    finally { $client.Dispose() }
}
function Get-DemoHealth([string]$Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 3 }
    catch { return $null }
}
function Start-DemoService([string]$ScriptName, [string]$Label) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $scriptPath = Join-Path $PSScriptRoot $ScriptName
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -WorkingDirectory $DemoRoot `
        -ArgumentList @('-NoProfile', '-File', ('"' + $scriptPath + '"')) `
        -RedirectStandardOutput (Join-Path $DemoLogs "$Label-$stamp.log") `
        -RedirectStandardError (Join-Path $DemoLogs "$Label-$stamp-error.log") | Out-Null
}
# Prefer an already-running FedHealth API; otherwise choose the first free port.
$apiPort = $null
$firstFreePort = $null
$candidates = if ($env:API_PORT) { @([int]$env:API_PORT) } else { @(3001..3010) }
foreach ($candidate in $candidates) {
    if (Test-DemoPort $candidate) {
        $health = Get-DemoHealth "http://127.0.0.1:$candidate/api/v1/health"
        if ($health.service -eq 'fedhealth-api') { $apiPort = $candidate; break }
    } elseif ($null -eq $firstFreePort) { $firstFreePort = $candidate }
}
if ($null -eq $apiPort) { $apiPort = $firstFreePort }
if ($null -eq $apiPort) { throw 'No API port is available. Inspect local listeners or set API_PORT to a free port.' }
$env:API_PORT = [string]$apiPort
$env:FEDHEALTH_API_PROXY_TARGET = "http://127.0.0.1:$apiPort"
$mlHealth = Get-DemoHealth 'http://127.0.0.1:8000/api/v1/health'
if (-not (Test-DemoPort $apiPort) -or $mlHealth.service -ne 'ml-service' -or $mlHealth.status -ne 'healthy') {
    Write-Host "Starting FedHealth backend on port $apiPort..."
    Start-DemoService 'start-backend.ps1' 'backend'
}
Write-Host 'Waiting for the API, database and ML service (up to 3 minutes)...'
$deadline = (Get-Date).AddMinutes(3)
do {
    $ready = Get-DemoHealth "http://127.0.0.1:$apiPort/api/v1/health/ready"
    if ($ready.status -eq 'ready') { break }
    Start-Sleep -Seconds 1
} while ((Get-Date) -lt $deadline)
if ($ready.status -ne 'ready') { throw "Backend not ready. Check internet/Neon access and logs in $DemoLogs." }
$restartFrontend = $false
if (Test-DemoPort 5173) {
    $proxy = Get-DemoHealth 'http://127.0.0.1:5173/api/v1/health'
    if ($proxy.service -ne 'fedhealth-api') {
        # Restart only this checkout's Vite process when its proxy is stale.
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 5173)
        foreach ($listener in $listeners) {
            $owner = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $listener.OwningProcess)
            $expected = [regex]::Escape((Join-Path $DemoRoot 'frontend'))
            if ($owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch $expected -or $owner.CommandLine -notmatch 'vite') {
                throw 'Port 5173 is occupied by another application; it was left untouched.'
            }
        }
        foreach ($listener in $listeners) { Stop-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue }
        $restartFrontend = $true
        $closeDeadline = (Get-Date).AddSeconds(10)
        while ((Test-DemoPort 5173) -and (Get-Date) -lt $closeDeadline) { Start-Sleep -Milliseconds 200 }
        if (Test-DemoPort 5173) { throw 'The previous frontend has not released port 5173 yet. Retry after it closes.' }
    }
}
if ($restartFrontend -or -not (Test-DemoPort 5173)) {
    Write-Host 'Starting frontend with the matching API connection...'
    Start-DemoService 'start-frontend.ps1' 'frontend'
}
$deadline = (Get-Date).AddSeconds(45)
do {
    $proxy = Get-DemoHealth 'http://127.0.0.1:5173/api/v1/health'
    if ($proxy.service -eq 'fedhealth-api') {
        Write-Host "READY: http://127.0.0.1:5173/ (FedHealth API: $apiPort)"
        Write-Host 'Internet is required for the configured Neon database. Logs are in the logs folder.'
        exit 0
    }
    Start-Sleep -Seconds 1
} while ((Get-Date) -lt $deadline)
throw "Frontend not ready. Check logs in $DemoLogs."
