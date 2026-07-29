#Requires -Version 5.1
<#
.SYNOPSIS
    Fix folder permissions for IIS deployment (standalone - no full redeploy needed).
.EXAMPLE
    .\fix-iis-acl.ps1
    .\fix-iis-acl.ps1 -DeployRoot "C:\inetpub\InvoiceApp"
#>
[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$ApiAppPool = "InvoiceAppApi"
)

$ErrorActionPreference = "Stop"
$ApiDeployPath = Join-Path $DeployRoot "Api"
$ApiPoolIdentity = "IIS AppPool\$ApiAppPool"

. (Join-Path $PSScriptRoot "scripts\deploy\Deploy.FolderAcl.ps1")

$paths = @{
    Wwwroot = Join-Path $ApiDeployPath "wwwroot"
    Backups = Join-Path $ApiDeployPath "wwwroot\backups\shared"
    Logs    = Join-Path $ApiDeployPath "logs"
}

$sqlAccounts = @("NT SERVICE\MSSQLSERVER", "NT SERVICE\MSSQL`$SQLEXPRESS")

Write-Host "Granting folder permissions (Set-Acl)..." -ForegroundColor Cyan
Grant-FolderAcl -Path $paths.Wwwroot -Accounts @($ApiPoolIdentity, "IIS_IUSRS", "NETWORK SERVICE")
Grant-FolderAcl -Path $paths.Backups -Accounts (@($ApiPoolIdentity, "IIS_IUSRS") + @($sqlAccounts))
Grant-FolderAcl -Path $paths.Logs -Accounts @($ApiPoolIdentity, "IIS_IUSRS")
Write-Host "[OK] Folder permissions applied." -ForegroundColor Green
