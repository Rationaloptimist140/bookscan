# =====================================================================
# BookScan — one-shot push to GitHub
# =====================================================================
# Run this from inside the extracted `bookscan` folder, in PowerShell.
#
#   cd C:\path\to\bookscan
#   .\push-to-github.ps1
#
# Git authenticates through your browser or Windows Credential Manager.
# No token is ever typed, pasted, or stored by this script.
#
# If the repo already has commits and you want to overwrite it, append -Force:
#   .\push-to-github.ps1 -Force
# =====================================================================

param(
    [string]$Owner  = "Rationaloptimist140",
    [string]$Repo   = "bookscan",
    [string]$Branch = "main",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "BookScan -> github.com/$Owner/$Repo ($Branch)" -ForegroundColor Cyan
Write-Host ""

# --- sanity check: are we in the right folder? ---
if (-not (Test-Path "package.json") -or -not (Test-Path "backend")) {
    Write-Host "ERROR: run this from inside the extracted 'bookscan' folder." -ForegroundColor Red
    Write-Host "       Expected to find package.json and backend\ here."      -ForegroundColor Red
    exit 1
}

# --- guard: never commit real secrets ---
foreach ($f in @(".env", ".env.local", "backend\.env")) {
    if (Test-Path $f) {
        Write-Host "WARNING: $f exists locally." -ForegroundColor Yellow
        Write-Host "         .gitignore excludes it, but double-check before pushing." -ForegroundColor Yellow
    }
}

# --- init repo if needed ---
if (-not (Test-Path ".git")) {
    Write-Host "Initialising git repository..." -ForegroundColor Gray
    git init | Out-Null
} else {
    Write-Host "Existing git repository found, reusing it." -ForegroundColor Gray
}

git branch -M $Branch

# --- stage and commit ---
Write-Host "Staging files..." -ForegroundColor Gray
git add .

$staged = (git diff --cached --numstat | Measure-Object).Count
if ($staged -eq 0) {
    Write-Host "Nothing to commit - working tree matches HEAD." -ForegroundColor Yellow
} else {
    Write-Host "Committing $staged file(s)..." -ForegroundColor Gray
    git commit -m "BookScan: full-stack book triage and AI training data platform

Next.js 14 App Router frontend + FastAPI backend + Supabase.
Typecheck clean, ESLint clean, production build passing." | Out-Null
}

# --- wire up remote ---
$remoteUrl = "https://github.com/$Owner/$Repo.git"
$existing = git remote 2>$null
if ($existing -contains "origin") {
    git remote set-url origin $remoteUrl
    Write-Host "Updated remote 'origin' -> $remoteUrl" -ForegroundColor Gray
} else {
    git remote add origin $remoteUrl
    Write-Host "Added remote 'origin' -> $remoteUrl" -ForegroundColor Gray
}

# --- push ---
Write-Host ""
Write-Host "Pushing to $remoteUrl ..." -ForegroundColor Cyan
Write-Host "(a browser window may open for authentication)" -ForegroundColor Gray
Write-Host ""

if ($Force) {
    git push -u origin $Branch --force
} else {
    git push -u origin $Branch
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done. https://github.com/$Owner/$Repo" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Push failed." -ForegroundColor Red
    Write-Host "If the remote already has commits, re-run with -Force to overwrite:" -ForegroundColor Yellow
    Write-Host "    .\push-to-github.ps1 -Force" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
