#Requires -Version 5.1
<#
.SYNOPSIS
    Fix IIS HTTP 500.52 URL Rewrite errors and refresh frontend web.config.

.EXAMPLE
    .\fix-iis-rewrite.ps1
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [int]$ApiPort = 5001
)

$WebConfigPath = Join-Path $DeployRoot "Web\web.config"
$ModuleRoot = Join-Path $PSScriptRoot "scripts\deploy"

function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }

if (-not (Test-Path (Split-Path $WebConfigPath -Parent))) {
    Write-Host "[ERROR] Web folder not found: $(Split-Path $WebConfigPath -Parent)" -ForegroundColor Red
    exit 1
}

. (Join-Path $ModuleRoot "Deploy.Logging.ps1")
. (Join-Path $ModuleRoot "Deploy.Config.ps1")

New-FrontendWebConfig -Path $WebConfigPath -BackendPort $ApiPort
Write-Ok "Rewrote $WebConfigPath"

Import-Module WebAdministration -ErrorAction SilentlyContinue
try {
    Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
    Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "preserveHostHeader" -Value "False"
    Write-Ok "ARR proxy: preserveHostHeader=false"
}
catch {
    Write-Host "[WARN] Could not set ARR proxy settings: $($_.Exception.Message)" -ForegroundColor Yellow
}

try { & iisreset /noforce | Out-Null; Write-Ok "IIS restarted" } catch { }

Write-Host ""
Write-Host "Open http://localhost and test again." -ForegroundColor Green
