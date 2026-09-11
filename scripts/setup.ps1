# One-shot setup for a fresh machine. Safe to re-run - every step is skipped if its
# output already exists, so re-running after a partial/failed run just resumes.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Covers:
#   1. npm install
#   2. .env
#   3. Offline map tiles (PMTiles regional extract)
#
# Address geocoding is online-only (see docs/OFFLINE_SETUP.md and scripts/geocode/server.mjs) and
# needs no local build step - it needs no native compiler either, since there's no better-sqlite3
# (or any other native addon) in this project anymore.
#
# Region defaults to California (matches docs/OFFLINE_SETUP.md's example). Override with -Region /
# -Bbox if you need a different state.

param(
    [string]$Region = "california",
    [string]$Bbox = "-124.5,32.5,-114.0,42.1"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Skip($msg) { Write-Host "[SKIP] $msg (already present)" -ForegroundColor DarkGray }

# ---------------------------------------------------------------------------
Step "1. npm install"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Ok "Dependencies installed"

# ---------------------------------------------------------------------------
Step "2. .env"
if (Test-Path ".env") {
    Skip ".env"
} else {
    Copy-Item ".env.example" ".env"
    Ok ".env created from .env.example"
}

# ---------------------------------------------------------------------------
Step "3. Offline map tiles (PMTiles)"

$pmtilesFile = "public/tiles/region.pmtiles"
if (Test-Path $pmtilesFile) {
    Skip "$pmtilesFile"
} else {
    $pmtilesExe = Get-Command pmtiles -ErrorAction SilentlyContinue
    if (-not $pmtilesExe) {
        Write-Host "pmtiles CLI not found, downloading go-pmtiles from GitHub releases..." -ForegroundColor Yellow
        $toolsDir = "tools"
        New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/protomaps/go-pmtiles/releases/latest" -Headers @{ "User-Agent" = "setup-script" }
        $asset = $release.assets | Where-Object { $_.name -match "(?i)windows.*(amd64|x86_64).*\.zip$" } | Select-Object -First 1
        if (-not $asset) { throw "Could not find a Windows amd64 go-pmtiles release asset" }
        $zipPath = Join-Path $toolsDir "go-pmtiles.zip"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
        Remove-Item $zipPath
        $pmtilesExePath = (Get-ChildItem -Path $toolsDir -Filter "pmtiles.exe" -Recurse | Select-Object -First 1).FullName
        if (-not $pmtilesExePath) { throw "pmtiles.exe not found after extracting release zip" }
        Ok "Downloaded pmtiles CLI to $pmtilesExePath"
    } else {
        $pmtilesExePath = $pmtilesExe.Source
    }

    Write-Host "Finding latest available Protomaps daily build..." -ForegroundColor Yellow
    $buildDate = $null
    for ($i = 0; $i -lt 10; $i++) {
        $candidate = (Get-Date).AddDays(-$i).ToString("yyyyMMdd")
        $url = "https://build.protomaps.com/$candidate.pmtiles"
        try {
            $resp = Invoke-WebRequest -Uri $url -Method Head -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { $buildDate = $candidate; break }
        } catch { continue }
    }
    if (-not $buildDate) { throw "Could not find a recent Protomaps daily build (tried last 10 days)" }
    Ok "Using build $buildDate"

    New-Item -ItemType Directory -Force -Path "offline-data/tiles" | Out-Null
    New-Item -ItemType Directory -Force -Path "public/tiles" | Out-Null
    $tempTiles = "offline-data/tiles/$Region.pmtiles"

    Write-Host "Extracting $Region region from daily build (this streams only your bbox, not the whole planet)..." -ForegroundColor Yellow
    & $pmtilesExePath extract "https://build.protomaps.com/$buildDate.pmtiles" $tempTiles --bbox=$Bbox --maxzoom=14
    if ($LASTEXITCODE -ne 0) { throw "pmtiles extract failed" }

    Move-Item $tempTiles $pmtilesFile -Force
    Ok "Built $pmtilesFile"
}

# ---------------------------------------------------------------------------
Step "Done"
Write-Host "Everything is set up. To run the app:" -ForegroundColor Green
Write-Host "  Terminal 1:  npm run geocode:serve"
Write-Host "  Terminal 2:  npm run dev"
