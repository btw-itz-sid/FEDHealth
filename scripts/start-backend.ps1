# Starts the ML service, then the API. Closing this window stops the ML
# process this script started. A ML service that was already running is left alone.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$MlDir = Join-Path $Root "backend\ml-service"
$ApiDir = Join-Path $Root "backend\api"
$Python = Join-Path $MlDir ".venv\Scripts\python.exe"

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

if (-not (Test-Path $Python)) {
  Write-Host "Python venv not found at backend\ml-service\.venv"
  Write-Host "Create it once:"
  Write-Host "  cd backend\ml-service"
  Write-Host "  python -m venv .venv"
  Write-Host "  .venv\Scripts\pip install -r requirements.txt"
  exit 1
}

$mlProc = $null
if (Test-Listening 8000) {
  Write-Host "ML service already running at http://localhost:8000"
} else {
  Write-Host "Starting ML service at http://localhost:8000"
  $mlProc = Start-Process -FilePath $Python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory $MlDir -PassThru -WindowStyle Minimized
  $deadline = (Get-Date).AddSeconds(30)
  while (-not (Test-Listening 8000)) {
    if ($mlProc.HasExited) {
      Write-Host "ML service exited early (code $($mlProc.ExitCode))."
      exit 1
    }
    if ((Get-Date) -gt $deadline) {
      Write-Host "ML service did not open port 8000 in time."
      exit 1
    }
    Start-Sleep -Milliseconds 400
  }
  Write-Host "ML service is up."
}

Write-Host "Starting API at http://localhost:3001"
Set-Location $ApiDir
try {
  npm run start:dev
} finally {
  if ($mlProc -and -not $mlProc.HasExited) {
    Write-Host "Stopping ML service..."
    & taskkill /PID $mlProc.Id /T /F | Out-Null
  }
}
