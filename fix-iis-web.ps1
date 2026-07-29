#Requires -Version 5.1
<#
.SYNOPSIS
    Fix common IIS frontend issues: port 80 conflict, web.config MIME types, site binding.

.EXAMPLE
    .\fix-iis-web.ps1
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$WebSiteName = "InvoiceApp-Web",
    [int]$WebPort = 80,
    [int]$ApiPort = 5001
)

$WebPath = Join-Path $DeployRoot "Web"
$ModuleRoot = Join-Path $PSScriptRoot "scripts\deploy"

if (-not (Test-Path $WebPath)) {
    Write-Host "[ERROR] Web folder not found: $WebPath" -ForegroundColor Red
    exit 1
}

. (Join-Path $ModuleRoot "Deploy.Logging.ps1")
. (Join-Path $ModuleRoot "Deploy.Config.ps1")
. (Join-Path $ModuleRoot "Deploy.Iis.ps1")

function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }

Write-Host "Fixing IIS web frontend..." -ForegroundColor Cyan

Import-Module WebAdministration -ErrorAction Stop

Resolve-WebPortBindingConflict -PreferredSiteName $WebSiteName -Port $WebPort

$site = Get-Website -Name $WebSiteName -ErrorAction SilentlyContinue
if ($site) {
    Set-ItemProperty "IIS:\Sites\$WebSiteName" -Name physicalPath -Value $WebPath
    Write-Ok "Site '$WebSiteName' physical path -> $WebPath"
}
else {
    Write-Host "[WARN] Site '$WebSiteName' not found. Run deploy-iis.ps1 first." -ForegroundColor Yellow
}

$indexPath = Join-Path $WebPath "index.html"
if ((Test-Path $indexPath) -and ((Get-Content $indexPath -Raw) -match '/src/main\.tsx')) {
    Write-Host "[WARN] Dev index.html detected. Run .\rebuild-web.ps1 to build production frontend." -ForegroundColor Yellow
}

New-FrontendWebConfig -Path (Join-Path $WebPath "web.config") -BackendPort $ApiPort
Write-Ok "Updated web.config (MIME types + defaultDocument)"

Enable-ArrProxySettings | Out-Null

try {
    Start-Website -Name $WebSiteName -ErrorAction SilentlyContinue
    Write-Ok "Started site: $WebSiteName"
}
catch { }

try { & iisreset /noforce | Out-Null; Write-Ok "IIS restarted" } catch { }

Write-Host ""
Write-Host "Run .\diagnose-iis-web.ps1 to verify, then open http://localhost" -ForegroundColor Green
