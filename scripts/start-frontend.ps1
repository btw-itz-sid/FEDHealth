$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $Root "frontend")
Write-Host "Starting web app at http://localhost:5173"
npm run dev
