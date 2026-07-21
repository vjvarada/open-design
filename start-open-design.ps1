# Open Design — Start Script
# Double-click this file to launch all services (daemon + web + desktop).
# Keep this window open while using Open Design; minimize it if needed.
#
# To stop: press Ctrl+C in this window, or run stop-open-design.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open Design — Starting services..."   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
try {
    $nodeVer = node --version 2>&1
    Write-Host "  Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Install Node ~24 from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

try {
    $pnpmVer = pnpm --version 2>&1
    Write-Host "  pnpm:    $pnpmVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: pnpm not found. Run: npm install -g pnpm@10.33.2" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting daemon + web + desktop..." -ForegroundColor Yellow
Write-Host "This window must stay open. Minimize it to keep services running." -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor DarkGray
Write-Host ""

# Use `run web` to keep services in foreground — closing this window stops them
pnpm tools-dev run web

# If we get here, services were stopped
Write-Host ""
Write-Host "Services stopped." -ForegroundColor Yellow
Read-Host "Press Enter to close"
