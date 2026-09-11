# One-shot setup for a fresh machine. Safe to re-run — every step is skipped if its
# output already exists, so re-running after a partial/failed run just resumes.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Covers:
#   1. Native build toolchain (MSVC + Windows SDK) needed for better-sqlite3
#   2. npm install
#   3. .env
#   4. Offline geocoding data (OpenStreetMap extract -> address index)
#   5. Offline map tiles (PMTiles regional extract)
#
# Region defaults to California (matches docs/OFFLINE_SETUP.md's example). Override
# with -Region / -GeofabrikPath / -Bbox if you need a different state.

param(
    [string]$Region = "california",
    [string]$GeofabrikPath = "north-america/us/california-latest.osm.pbf",
    [string]$Bbox = "-124.5,32.5,-114.0,42.1"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Skip($msg) { Write-Host "[SKIP] $msg (already present)" -ForegroundColor DarkGray }

# ---------------------------------------------------------------------------
Step "1. Native build toolchain (MSVC + Windows SDK)"

$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"

# Version folder varies by release ("2022" for VS17, but newer releases use their
# raw product major version e.g. "18") — don't hardcode it, discover it instead.
$clFound = Get-ChildItem "C:\Program Files*\Microsoft Visual Studio\*\*\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe" -ErrorAction SilentlyContinue
$sdkFound = Test-Path "C:\Program Files (x86)\Windows Kits\10\Include" -PathType Container

if ($clFound -and $sdkFound -and (Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -ErrorAction SilentlyContinue)) {
    Skip "MSVC compiler + Windows SDK"
} else {
    # Only the small bootstrapper (vs_buildtools.exe) reliably supports --wait and
    # actually blocks until the real (elevated) install finishes. The already-installed
    # Installer's own CLI (vs_installer.exe / setup.exe modify|repair|uninstall --wait)
    # silently rejects --wait as an unknown option and no-ops instead of erroring — do
    # not use that path here, it was the cause of a stuck/incomplete SDK install that
    # looked like success (exit 0) while never actually downloading anything.
    Write-Host "Ensuring MSVC compiler + Windows 11 SDK are installed (downloading bootstrapper)..." -ForegroundColor Yellow
    $bootstrapper = Join-Path $env:TEMP "vs_buildtools.exe"
    curl.exe -L --ssl-no-revoke -o $bootstrapper https://aka.ms/vs/17/release/vs_buildtools.exe
    if ($LASTEXITCODE -ne 0) { throw "Failed to download vs_buildtools.exe bootstrapper" }

    $existingInstallPath = if (Test-Path $vswhere) { & $vswhere -all -property installationPath | Select-Object -First 1 } else { $null }

    if ($existingInstallPath) {
        # Existing (possibly partial) instance — add only what's missing to it.
        # Discovered via vswhere rather than assumed, since the version folder
        # (2022, 18, ...) varies by release.
        & $bootstrapper modify --installPath $existingInstallPath `
            --add Microsoft.VisualStudio.Workload.VCTools `
            --add Microsoft.VisualStudio.Component.Windows11SDK.26100 `
            --quiet --wait --norestart
    } else {
        # No instance at all — fresh install. Deliberately no -includeRecommended:
        # that pulls in ASAN, CMake project templates, test tools, Vcpkg, etc. that
        # better-sqlite3 (or any typical native addon) doesn't need.
        & $bootstrapper --quiet --wait --norestart `
            --add Microsoft.VisualStudio.Workload.VCTools `
            --add Microsoft.VisualStudio.Component.Windows11SDK.26100
    }
    Remove-Item $bootstrapper -ErrorAction SilentlyContinue

    $clFound = Get-ChildItem "C:\Program Files*\Microsoft Visual Studio\*\*\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe" -ErrorAction SilentlyContinue
    $sdkFound = Test-Path "C:\Program Files (x86)\Windows Kits\10\Include" -PathType Container
    if (-not $clFound -or -not $sdkFound -or -not (Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -ErrorAction SilentlyContinue)) {
        Write-Host "MSVC/Windows SDK still not found after install attempt. Open 'Visual Studio Installer' manually and verify the 'Desktop development with C++' workload is checked." -ForegroundColor Red
        exit 1
    }
    Ok "MSVC compiler + Windows SDK installed"
}

# ---------------------------------------------------------------------------
Step "2. npm install"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Ok "Dependencies installed"

# Verify better-sqlite3 actually loads (catches a build that 'succeeded' but produced
# a broken binding, the way ours silently did on the first VS install attempt).
node -e "require('better-sqlite3')(':memory:').prepare('select 1').get()"
if ($LASTEXITCODE -ne 0) {
    Write-Host "better-sqlite3 failed to load, rebuilding..." -ForegroundColor Yellow
    npm rebuild better-sqlite3
    node -e "require('better-sqlite3')(':memory:').prepare('select 1').get()"
    if ($LASTEXITCODE -ne 0) { throw "better-sqlite3 still broken after rebuild" }
}
Ok "better-sqlite3 loads and runs"

# ---------------------------------------------------------------------------
Step "3. .env"
if (Test-Path ".env") {
    Skip ".env"
} else {
    Copy-Item ".env.example" ".env"
    Ok ".env created from .env.example"
}

# ---------------------------------------------------------------------------
Step "4. Offline geocoding data"
New-Item -ItemType Directory -Force -Path "offline-data/raw" | Out-Null

$pbfPath = "offline-data/raw/$Region-latest.osm.pbf"
$jsonlPath = "offline-data/raw/$Region-addresses.jsonl"
$indexPath = "offline-data/geocode-index.sqlite"

if (Test-Path $pbfPath) {
    Skip "$pbfPath"
} else {
    Write-Host "Downloading $Region OSM extract from Geofabrik..." -ForegroundColor Yellow
    curl.exe -L --ssl-no-revoke -o $pbfPath "https://download.geofabrik.de/$GeofabrikPath"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $pbfPath) -or (Get-Item $pbfPath).Length -lt 1MB) {
        Remove-Item $pbfPath -ErrorAction SilentlyContinue
        throw "OSM extract download failed"
    }
    Ok "Downloaded $pbfPath"
}

if (Test-Path $jsonlPath) {
    Skip "$jsonlPath"
} else {
    Write-Host "Extracting addresses with pbf2json (can take several minutes)..." -ForegroundColor Yellow
    npx pbf2json -tags="addr:housenumber" $pbfPath | Out-File -Encoding utf8 $jsonlPath
    if ($LASTEXITCODE -ne 0) { throw "pbf2json extraction failed" }
    Ok "Extracted $jsonlPath"
}

if (Test-Path $indexPath) {
    Skip "$indexPath"
} else {
    Write-Host "Building geocode search index..." -ForegroundColor Yellow
    npm run geocode:build -- $jsonlPath $indexPath
    if ($LASTEXITCODE -ne 0) { throw "geocode:build failed" }
    Ok "Built $indexPath"
}

# ---------------------------------------------------------------------------
Step "5. Offline map tiles (PMTiles)"

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
