# Open Design — Stop Script
# Stops all running Open Design services gracefully.

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "Stopping Open Design services..." -ForegroundColor Yellow
pnpm tools-dev stop
Write-Host "Done." -ForegroundColor Green
