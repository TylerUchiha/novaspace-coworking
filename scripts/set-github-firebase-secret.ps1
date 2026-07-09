# One-time setup: stores FIREBASE_TOKEN for GitHub Actions auto-deploy.
# Run in Windows Terminal or PowerShell OUTSIDE Cursor (firebase login:ci needs a real TTY).
param(
  [string]$Repo = 'TylerUchiha/novaspace-coworking'
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '=== NovaSpace GitHub deploy secret setup ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI (gh) is not installed. Install from https://cli.github.com/'
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw 'Firebase CLI is not installed. Run: npm install -g firebase-tools'
}

Write-Host 'Step 1: Generate a Firebase CI token (browser sign-in may open)...' -ForegroundColor Yellow
$token = firebase login:ci 2>&1 | ForEach-Object { $_.ToString() } | Where-Object { $_ -match '^1//|^ya29\.' -or $_.Length -gt 80 } | Select-Object -Last 1

if (-not $token -or $token -match 'Error|Cannot run') {
  Write-Host ''
  Write-Host 'Automatic capture failed. Run manually:' -ForegroundColor Yellow
  Write-Host '  firebase login:ci'
  Write-Host 'Then paste the token below.'
  Write-Host ''
  $token = Read-Host 'Firebase CI token'
}

$token = $token.Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'No token provided.'
}

Write-Host ''
Write-Host 'Step 2: Saving FIREBASE_TOKEN to GitHub repository secrets...' -ForegroundColor Yellow
$token | gh secret set FIREBASE_TOKEN --repo $Repo

Write-Host ''
Write-Host 'Done. FIREBASE_TOKEN is configured on' $Repo -ForegroundColor Green
Write-Host 'Trigger a deploy: gh workflow run deploy.yml --repo' $Repo
Write-Host ''
