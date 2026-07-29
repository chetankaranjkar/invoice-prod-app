#Requires -Version 5.1
<#
.SYNOPSIS
    Rebuild and redeploy only the React frontend to IIS Web folder.

.EXAMPLE
    .\rebuild-web.ps1
    .\rebuild-web.ps1 -DeployRoot "C:\inetpub\InvoiceApp"
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$WebSiteName = "InvoiceApp-Web",
    [int]$WebPort = 80,
    [int]$ApiPort = 5001,
    [string]$WebAppPool = "InvoiceAppWeb",
    [string]$ApiSiteName = "InvoiceApp-API",
    [string]$ApiAppPool = "InvoiceAppApi"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModuleRoot = Join-Path $PSScriptRoot "scripts\deploy"
foreach ($mod in @("Deploy.Logging.ps1", "Deploy.Build.ps1", "Deploy.Config.ps1", "Deploy.Iis.ps1")) {
    . (Join-Path $ModuleRoot $mod)
}

$Config = @{
    DeployRoot      = $DeployRoot
    WebPort         = $WebPort
    ApiPort         = $ApiPort
    WebSiteName     = $WebSiteName
    WebAppPool      = $WebAppPool
    ApiSiteName     = $ApiSiteName
    ApiAppPool      = $ApiAppPool
    RepoRoot        = $PSScriptRoot
    WebProject      = Join-Path $PSScriptRoot "invoice-app"
    WebDeployPath   = Join-Path $DeployRoot "Web"
}

Write-Host "Rebuilding frontend..." -ForegroundColor Cyan
Invoke-WebFrontendRebuild -Config $Config

New-FrontendWebConfig -Path (Join-Path $Config.WebDeployPath "web.config") -BackendPort $ApiPort

Import-Module WebAdministration -ErrorAction Stop
Resolve-WebPortBindingConflict -PreferredSiteName $WebSiteName -Port $WebPort
Set-ItemProperty "IIS:\Sites\$WebSiteName" -Name physicalPath -Value $Config.WebDeployPath -ErrorAction SilentlyContinue
Start-Website -Name $WebSiteName -ErrorAction SilentlyContinue

Test-DeployedWebFrontend -Config $Config -ThrowOnFailure

Write-Host ""
Write-Host "Frontend rebuilt. Open http://localhost (Ctrl+F5 to hard refresh)." -ForegroundColor Green
