# PowerShell installation script for Windows
$ErrorActionPreference = "Stop"

Write-Host "Installing otak-mcp-filesystem..." -ForegroundColor Green

# Download latest release
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/tsuyoshi-otake/otak-mcp-filesystem/releases/latest"
$downloadUrl = $latestRelease.assets | Where-Object { $_.name -eq "otak-mcp-filesystem.tgz" } | Select-Object -ExpandProperty browser_download_url

if (-not $downloadUrl) {
    Write-Error "Could not find release asset"
    exit 1
}

Write-Host "Downloading from: $downloadUrl"
$tempFile = Join-Path $env:TEMP "otak-mcp-filesystem.tgz"
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile

Write-Host "Installing package globally..."
npm install -g $tempFile

Remove-Item $tempFile -Force

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "Run 'otak-mcp-filesystem' to start the server"