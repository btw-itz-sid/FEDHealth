# Starts the ML service, then the API. Closing this window stops the ML
# process this script started. A ML service that was already running is left alone.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$MlDir = Join-Path $Root "backend\ml-service"
$ApiDir = Join-Path $Root "backend\api"
$Python = Join-Path $MlDir ".venv\Scripts\python.exe"
$ApiPort = if ($env:API_PORT) { [int]$env:API_PORT } else { 3001 }

function Test-Listening([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $wait = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $wait.AsyncWaitHandle.WaitOne(400, $false)
    if ($ok) { $client.EndConnect($wait) | Out-Null }
    return $ok
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-MlReady {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 2
    return $health.status -eq 'healthy' -and $health.service -eq 'ml-service'
  } catch { return $false }
}

if (-not (Test-Path $Python)) {
  Write-Host "Python venv not found at backend\ml-service\.venv"
  Write-Host "Create it once:"
  Write-Host "  cd backend\ml-service"
  Write-Host "  python -m venv .venv"
  Write-Host "  .venv\Scripts\pip install -r requirements.txt"
  exit 1
}

$mlProc = $null
if (Test-MlReady) {
  Write-Host "ML service already running at http://localhost:8000"
} else {
  if (Test-Listening 8000) {
    Write-Host "Port 8000 is occupied but the ML health check failed. Inspect the existing service before retrying."
    exit 1
  }
  Write-Host "Starting ML service at http://localhost:8000"
  $mlProc = Start-Process -FilePath $Python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory $MlDir -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(120)
  while (-not (Test-MlReady)) {
    if ($mlProc.HasExited) {
      Write-Host "ML service exited early (code $($mlProc.ExitCode))."
      exit 1
    }
    if ((Get-Date) -gt $deadline) {
      Write-Host "ML service did not become healthy within 120 seconds."
      if (-not $mlProc.HasExited) { & taskkill /PID $mlProc.Id /T /F | Out-Null }
      exit 1
    }
    Start-Sleep -Milliseconds 400
  }
  Write-Host "ML service is up."
}

if (Test-Listening $ApiPort) {
  try {
    $existing = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 3
    if ($existing.service -eq 'fedhealth-api') {
      Write-Host "FedHealth API already listening on port $ApiPort; no duplicate API started."
      exit 0
    }
  } catch { }
  Write-Host "Port $ApiPort belongs to another service. Use start-demo.cmd to select a free port."
  exit 1
}
Write-Host "Starting API at http://127.0.0.1:$ApiPort"
Set-Location $ApiDir
try {
  npm run start:dev
} finally {
  if ($mlProc -and -not $mlProc.HasExited) {
    Write-Host "Stopping ML service..."
    & taskkill /PID $mlProc.Id /T /F | Out-Null
  }
}
