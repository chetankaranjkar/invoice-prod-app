#Requires -Version 5.1
<#
.SYNOPSIS
    Diagnose IIS 500.30 ASP.NET Core startup failures for Invoice Master.

.EXAMPLE
    .\diagnose-iis-api.ps1
    .\diagnose-iis-api.ps1 -DeployRoot "C:\inetpub\InvoiceApp" -SqlServer ".\SQLEXPRESS"
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$SqlServer = "",
    [string]$ApiAppPool = "InvoiceAppApi"
)

$ApiPath = Join-Path $DeployRoot "Api"
$LogsPath = Join-Path $ApiPath "logs"
$ProdSettings = Join-Path $ApiPath "appsettings.Production.json"
$PoolIdentity = "IIS AppPool\$ApiAppPool"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Invoice Master - IIS API Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path $ApiPath)) {
    Write-Err "API folder not found: $ApiPath"
    exit 1
}

Write-Step "Checking ASP.NET Core Hosting Bundle..."
if (Test-Path "$env:SystemRoot\System32\inetsrv\aspnetcorev2.dll") {
    Write-Ok "AspNetCoreModuleV2 is installed"
}
else {
    Write-Err "Hosting Bundle missing. Run install-iis-prerequisites.ps1"
}

Write-Step "Checking API files..."
$dll = Join-Path $ApiPath "InvoiceApp.Api.dll"
if (Test-Path $dll) { Write-Ok "Found InvoiceApp.Api.dll" } else { Write-Err "Missing InvoiceApp.Api.dll" }

Write-Step "Checking production settings..."
if (Test-Path $ProdSettings) {
    Write-Ok "Found appsettings.Production.json"
    try {
        $settings = Get-Content $ProdSettings -Raw | ConvertFrom-Json
        $conn = $settings.ConnectionStrings.DefaultConnection
        if ($conn) {
            Write-Host "  Connection: $conn" -ForegroundColor Gray
            if ($conn -match "Server=([^;]+)") {
                if (-not $SqlServer) { $SqlServer = $Matches[1] }
            }
        }
        else {
            Write-Warn "No DefaultConnection in appsettings.Production.json"
        }
    }
    catch {
        Write-Warn "Could not parse appsettings.Production.json: $($_.Exception.Message)"
    }
}
else {
    Write-Warn "appsettings.Production.json not found - redeploy with deploy-iis.ps1"
}

if (-not $SqlServer) { $SqlServer = ".\SQLEXPRESS" }
Write-Host "  Using SQL Server instance: $SqlServer" -ForegroundColor Gray

Write-Step "Checking SQL Server service..."
$sqlServices = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq "Running" }
if ($sqlServices) {
    foreach ($svc in $sqlServices) {
        Write-Ok "Running: $($svc.Name)"
    }
}
else {
    Write-Err "No running SQL Server service found (MSSQL*)"
}

Write-Step "Testing SQL connection (Windows auth)..."
$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmd) {
    & sqlcmd -S $SqlServer -E -Q "SELECT @@VERSION" -h -1 -W 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "sqlcmd connected to $SqlServer"
    }
    else {
        Write-Err "sqlcmd failed for $SqlServer. Try: .\SQLEXPRESS or ."
    }
}
else {
    Write-Warn "sqlcmd not in PATH - install SSMS or SQL tools"
}

Write-Step "Checking app pool SQL login..."
if ($sqlcmd) {
    $loginCheck = "SELECT name FROM sys.server_principals WHERE name = N'$PoolIdentity'"
    $result = & sqlcmd -S $SqlServer -E -Q $loginCheck -h -1 -W 2>&1
    if ($result -match [regex]::Escape($ApiAppPool)) {
        Write-Ok "SQL login exists: $PoolIdentity"
    }
    else {
        Write-Err "SQL login missing: $PoolIdentity"
        Write-Host ""
        Write-Host "Run in SSMS:" -ForegroundColor Yellow
        Write-Host "  CREATE LOGIN [$PoolIdentity] FROM WINDOWS;" -ForegroundColor White
        Write-Host "  ALTER SERVER ROLE dbcreator ADD MEMBER [$PoolIdentity];" -ForegroundColor White
    }
}

Write-Step "Checking stdout logs..."
if (Test-Path $LogsPath) {
    $logFiles = Get-ChildItem $LogsPath -Filter "stdout*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    if ($logFiles) {
        $latest = $logFiles | Select-Object -First 1
        Write-Ok "Latest log: $($latest.FullName)"
        Write-Host ""
        Get-Content $latest.FullName -Tail 40 | ForEach-Object { Write-Host $_ }
    }
    else {
        Write-Warn "No stdout logs yet. Redeploy to enable logging, then recycle app pool and retry."
    }
}
else {
    Write-Warn "Logs folder missing: $LogsPath"
}

Write-Step "Trying to start API manually (10 second test)..."
Push-Location $ApiPath
try {
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    $job = Start-Job -ScriptBlock {
        param($Path)
        Set-Location $Path
        $env:ASPNETCORE_ENVIRONMENT = "Production"
        & dotnet (Join-Path $Path "InvoiceApp.Api.dll")
    } -ArgumentList $ApiPath

    Start-Sleep -Seconds 12
    if ($job.State -eq "Running") {
        Write-Ok "API process started successfully in manual test"
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
    else {
        $output = Receive-Job $job -ErrorAction SilentlyContinue
        Write-Err "API process exited during manual start"
        if ($output) {
            Write-Host ""
            $output | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
        }
    }
}
catch {
    Write-Err $_.Exception.Message
}
finally {
    Pop-Location
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
}

Write-Step "Checking IIS app pool..."
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (Test-Path "IIS:\AppPools\$ApiAppPool") {
    $pool = Get-Item "IIS:\AppPools\$ApiAppPool"
    Write-Host "  State: $($pool.State)" -ForegroundColor Gray
    Write-Host "  Runtime: $($pool.managedRuntimeVersion)" -ForegroundColor Gray
}
else {
    Write-Err "App pool not found: $ApiAppPool"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Common fixes for 500.30" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Redeploy with correct SQL instance:" -ForegroundColor White
Write-Host "   .\deploy-iis.ps1 -SqlServer '.\SQLEXPRESS' -SkipBuild" -ForegroundColor Gray
Write-Host "2. Create SQL login for app pool (see above)" -ForegroundColor White
Write-Host "3. Recycle app pool:" -ForegroundColor White
Write-Host "   Restart-WebAppPool -Name $ApiAppPool" -ForegroundColor Gray
Write-Host "4. Read logs:" -ForegroundColor White
Write-Host "   Get-Content '$LogsPath\stdout*.log' -Tail 50" -ForegroundColor Gray
Write-Host ""
