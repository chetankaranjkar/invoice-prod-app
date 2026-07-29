#Requires -Version 5.1
<#
.SYNOPSIS
    Production-grade IIS deployment for Invoice Master (API + React + SQL Server).

.DESCRIPTION
    Idempotent deployment script. Safe to run multiple times.
    Publishes the .NET 8 API, builds the React app, configures IIS sites,
    detects SQL Server, grants permissions, and waits for Entity Framework
    to create the database before granting db_owner.

    Run deploy-iis.bat as Administrator or:
      powershell -ExecutionPolicy Bypass -File .\deploy-iis.ps1

.PARAMETER DeployRoot
    Target folder on this PC (default: C:\inetpub\InvoiceApp).

.PARAMETER SqlServer
    SQL Server instance. Leave empty to auto-detect running instances.
    Use this parameter when multiple instances are available.

.PARAMETER SkipBuild
    Skip dotnet publish / npm build - use files already in DeployRoot.

.PARAMETER InstallIisFeatures
    Enable core IIS Windows features via DISM (requires reboot sometimes).

.EXAMPLE
    .\deploy-iis.ps1
    .\deploy-iis.ps1 -SqlServer "COMPUTERNAME\SQLEXPRESS" -DeployRoot "D:\InvoiceApp"
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$SqlServer = "",
    [string]$DatabaseName = "InvoiceApp",
    [int]$ApiPort = 5001,
    [int]$WebPort = 80,
    [string]$ApiAppPool = "InvoiceAppApi",
    [string]$WebAppPool = "InvoiceAppWeb",
    [string]$ApiSiteName = "InvoiceApp-API",
    [string]$WebSiteName = "InvoiceApp-Web",
    [string]$JwtSecret = "",
    [switch]$SkipBuild,
    [switch]$InstallIisFeatures,
    [switch]$AddLocalDomain,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Load deployment modules
# ---------------------------------------------------------------------------
$ModuleRoot = Join-Path $PSScriptRoot "scripts\deploy"
$modules = @(
    "Deploy.Context.ps1",
    "Deploy.Logging.ps1",
    "Deploy.Prerequisites.ps1",
    "Deploy.Sql.ps1",
    "Deploy.Iis.ps1",
    "Deploy.Build.ps1",
    "Deploy.Config.ps1",
    "Deploy.FolderAcl.ps1"   # MUST be last - overrides Grant-FolderAcl on stale PCs
)

foreach ($mod in $modules) {
    $path = Join-Path $ModuleRoot $mod
    if (-not (Test-Path $path)) {
        Write-Host "[ERROR] Missing deployment module: $path" -ForegroundColor Red
        Write-Host "  Copy the entire scripts\deploy folder from the latest repo to:" -ForegroundColor Yellow
        Write-Host "  $ModuleRoot" -ForegroundColor Yellow
        exit 1
    }
    . $path
}

$iisModulePath = Join-Path $ModuleRoot "Deploy.Iis.ps1"
if (Select-String -Path $iisModulePath -Pattern '\bicacls\b' -Quiet) {
    Write-Host "[WARN] Deploy.Iis.ps1 on this PC is outdated (uses icacls)." -ForegroundColor Yellow
    Write-Host "       Using Deploy.FolderAcl.ps1 override (Set-Acl). Update scripts\deploy when possible." -ForegroundColor Yellow
}
if (-not (Test-Path (Join-Path $ModuleRoot "Deploy.FolderAcl.ps1"))) {
    Write-Host "[ERROR] Missing Deploy.FolderAcl.ps1 - copy latest scripts\deploy folder." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# Deployment configuration (backward-compatible parameters)
# ---------------------------------------------------------------------------
$Config = @{
    DeployRoot      = $DeployRoot
    DatabaseName    = $DatabaseName
    ApiPort         = $ApiPort
    WebPort         = $WebPort
    ApiAppPool      = $ApiAppPool
    WebAppPool      = $WebAppPool
    ApiSiteName     = $ApiSiteName
    WebSiteName     = $WebSiteName
    SkipBuild       = [bool]$SkipBuild
    InstallIisFeatures = [bool]$InstallIisFeatures
    AddLocalDomain  = [bool]$AddLocalDomain
    RepoRoot        = $PSScriptRoot
    ApiProject      = Join-Path $PSScriptRoot "InvoiceApp.Api\InvoiceApp.Api.csproj"
    WebProject      = Join-Path $PSScriptRoot "invoice-app"
    ApiDeployPath   = Join-Path $DeployRoot "Api"
    WebDeployPath   = Join-Path $DeployRoot "Web"
    ApiPoolIdentity = "IIS AppPool\$ApiAppPool"
}

$exitCode = 0

try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Invoice Master - IIS Deployment" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    if (-not (Test-DeployAdministrator)) {
        Write-Host "[ERROR] Run as Administrator. Use deploy-iis.bat or right-click PowerShell -> Run as administrator." -ForegroundColor Red
        exit 1
    }

    Initialize-DeployContext -Config $Config

    # [1/12] Prerequisites
    Write-StepProgress "Checking prerequisites"
    Invoke-PrerequisiteValidation -Config $Config

    # [2/12] SQL detection
    Write-StepProgress "Detecting SQL Server instances"
    $resolvedSql = Resolve-SqlServerInstance -PreferredInstance $SqlServer

    # [3/12] SQL connection validation
    Write-StepProgress "Validating SQL connection and sysadmin"
    Invoke-SqlConnectionValidation -Server $resolvedSql

    # [4/12] Build & publish
    Write-StepProgress "Building and publishing application"
    Invoke-ApplicationBuild -Config $Config

    # [5/12] Configuration files
    Write-StepProgress "Writing configuration files"
    Invoke-ApplicationConfiguration -Config $Config -SqlServer $resolvedSql -JwtSecret $JwtSecret

    # [6/12] IIS app pools & websites (idempotent)
    Write-StepProgress "Configuring IIS application pools and websites"
    Invoke-IisDeployment -Config $Config

    # [7/12] SQL login
    Write-StepProgress "Ensuring SQL login for app pool identity"
    Ensure-SqlLogin -Server $resolvedSql -LoginName $Config.ApiPoolIdentity

    # [8/12] dbcreator role
    Write-StepProgress "Ensuring dbcreator server role"
    Ensure-DbCreator -Server $resolvedSql -LoginName $Config.ApiPoolIdentity

    # [9/12] Start API and wait for EF to create database
    Write-StepProgress "Starting API and waiting for database (Entity Framework Code First)"
    $apiHealthUrl = "http://127.0.0.1:$($Config.ApiPort)/health"
    $apiHealthy = Wait-ForUrl -Url $apiHealthUrl -Retries 40 -DelaySeconds 5

    if ($apiHealthy) {
        Write-Ok "API health check passed"
        Set-DeploySummary -Key ApiStarted -Value $true
    }
    else {
        Write-Warn "API health check did not pass yet. Check logs in $($Config.LogsPath)"
    }

    if (Test-SqlDatabaseExists -Server $resolvedSql -Database $Config.DatabaseName) {
        Write-Ok "Database '$($Config.DatabaseName)' exists"
        Set-DeploySummary -Key Database -Value $true
    }
    else {
        Write-Host "  Waiting for Entity Framework to create database..." -ForegroundColor Gray
        if (Wait-ForSqlDatabase -Server $resolvedSql -Database $Config.DatabaseName -Retries 60 -DelaySeconds 5) {
            Write-Ok "Database '$($Config.DatabaseName)' created by API"
            Set-DeploySummary -Key Database -Value $true
        }
        else {
            Write-Warn "Database was not created within wait period. Permissions will be skipped."
        }
    }

    # [10/12] Database user (SID-based, skip if already mapped/dbo)
    if (Test-SqlDatabaseExists -Server $resolvedSql -Database $Config.DatabaseName) {
        Write-StepProgress "Ensuring database user mapping (SID check)"
        Ensure-DatabaseUser -Server $resolvedSql -Database $Config.DatabaseName -LoginName $Config.ApiPoolIdentity | Out-Null

        # [11/12] db_owner permissions
        Write-StepProgress "Granting database permissions (db_owner if needed)"
        Grant-DatabasePermissions -Server $resolvedSql -Database $Config.DatabaseName -LoginName $Config.ApiPoolIdentity | Out-Null

        if (-not $apiHealthy) {
            try {
                Restart-WebAppPool -Name $Config.ApiAppPool -ErrorAction Stop
                Start-Sleep -Seconds 3
                if (Wait-ForUrl -Url $apiHealthUrl -Retries 20 -DelaySeconds 3) {
                    Write-Ok "API health check passed after permission grant"
                    Set-DeploySummary -Key ApiStarted -Value $true
                }
            }
            catch {
                Write-Warn "Could not recycle API app pool: $($_.Exception.Message)"
            }
        }
    }
    else {
        Write-StepProgress "Skipping database user and permissions (database does not exist yet)"
        Write-Warn "Run deployment again after API creates the database, or run .\fix-iis-sql.bat"
    }

    # [12/12] Firewall, hosts, frontend check
    Write-StepProgress "Finalizing deployment (firewall, hosts, frontend)"
    Invoke-FirewallAndHosts -Config $Config

    Import-Module WebAdministration -ErrorAction SilentlyContinue
    Resolve-WebPortBindingConflict -PreferredSiteName $Config.WebSiteName -Port $Config.WebPort
    if (Get-Website -Name $Config.WebSiteName -ErrorAction SilentlyContinue) {
        Set-ItemProperty "IIS:\Sites\$($Config.WebSiteName)" -Name physicalPath -Value $Config.WebDeployPath
        Start-Website -Name $Config.WebSiteName -ErrorAction SilentlyContinue
    }

    $webUrl = if ($Config.WebPort -eq 80) { "http://localhost" } else { "http://localhost:$($Config.WebPort)" }
    if (Wait-ForUrl -Url $webUrl -Retries 10 -DelaySeconds 2) {
        Write-Ok "Frontend reachable: $webUrl"
    }
    else {
        Write-Warn "Frontend not responding yet at $webUrl"
    }

    try {
        Test-DeployedWebFrontend -Config $Config -ThrowOnFailure
    }
    catch {
        Write-Err $_.Exception.Message
        Write-Host "  Run as Administrator: .\rebuild-web.ps1 then .\fix-iis-web.ps1" -ForegroundColor Yellow
    }

    # Summary output
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor Yellow
    Write-Host "  App:  $webUrl"
    Write-Host "  API:  http://127.0.0.1:$($Config.ApiPort)/health (internal)"
    if ($Config.AddLocalDomain) {
        $domainPort = if ($Config.WebPort -ne 80) { ":$($Config.WebPort)" } else { "" }
        Write-Host "  Domain: http://invoiceapp.local$domainPort"
    }
    Write-Host ""
    Write-Host "Paths:" -ForegroundColor Yellow
    Write-Host "  API:  $($Config.ApiDeployPath)"
    Write-Host "  Web:  $($Config.WebDeployPath)"
    Write-Host "  SQL:  $resolvedSql / $($Config.DatabaseName)"
    Write-Host ""

    Write-DeploymentSummary
}
catch {
    $exitCode = 1
    $message = $_.Exception.Message
    if ($_.ScriptStackTrace) {
        $message += "`n$($_.ScriptStackTrace)"
    }
    Write-ErrorLog "Deployment failed: $message"
    Write-Host ""
    Write-Host "Deployment FAILED. See Errors.log for details." -ForegroundColor Red
    Write-Host "Attempting rollback of changes made in this run..." -ForegroundColor Yellow
    try {
        Invoke-DeployRollback
    }
    catch {
        Write-ErrorLog "Rollback error: $($_.Exception.Message)"
    }
}
finally {
    if (-not $NoPause -and $exitCode -ne 0) {
        Write-Host ""
        Write-Host "Press Enter to exit..."
        [void][System.Console]::ReadLine()
    }
    elseif (-not $NoPause -and $exitCode -eq 0) {
        Write-Host "Press Enter to exit..."
        [void][System.Console]::ReadLine()
    }
}

exit $exitCode
