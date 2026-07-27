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
$sqlServices = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue
if ($sqlServices) {
    foreach ($svc in $sqlServices) {
        $color = if ($svc.Status -eq "Running") { "Green" } else { "Red" }
        Write-Host "  $($svc.Name): $($svc.Status)" -ForegroundColor $color
    }
}
else {
    Write-Err "No SQL Server services found. Install SQL Server Express first."
    Write-Host "  Run: .\install-iis-prerequisites.ps1 -IncludeSqlServer" -ForegroundColor Gray
}

Write-Step "Detecting SQL Server instances..."
$instanceKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
$detectedServers = @()
if (Test-Path $instanceKey) {
    $props = Get-ItemProperty $instanceKey
    foreach ($prop in $props.PSObject.Properties) {
        if ($prop.Name -in @("PSPath", "PSParentPath", "PSChildName", "PSDrive", "PSProvider")) { continue }
        if ($prop.Name -eq "MSSQLSERVER") {
            $detectedServers += ".", "localhost"
        }
        else {
            $detectedServers += ".\$($prop.Name)", "localhost\$($prop.Name)"
        }
    }
    Write-Ok "Detected instances: $($detectedServers -join ', ')"
}
else {
    Write-Warn "No SQL instances found in registry"
    $detectedServers = @(".", ".\SQLEXPRESS", "localhost\SQLEXPRESS")
}

Write-Step "Testing SQL connection (Windows auth)..."
$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
    $sqlcmdPath = @(
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($sqlcmdPath) { $sqlcmd = Get-Item $sqlcmdPath }
}

$connectedServer = $null
if ($sqlcmd) {
    $serversToTry = @($SqlServer) + $detectedServers | Where-Object { $_ } | Select-Object -Unique
    foreach ($server in $serversToTry) {
        & $sqlcmd.Source -S $server -E -Q "SELECT 1" -h -1 -W 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $connectedServer = $server
            Write-Ok "sqlcmd connected to $server"
            $SqlServer = $server
            break
        }
    }
    if (-not $connectedServer) {
        Write-Err "sqlcmd could not connect to any SQL instance."
        Write-Host "  Run: .\fix-iis-sql.bat" -ForegroundColor Yellow
    }
}
else {
    Write-Warn "sqlcmd not found - install SSMS"
}

Write-Step "Checking app pool SQL login..."
if ($sqlcmd -and $connectedServer) {
    $loginCheck = "SELECT name FROM sys.server_principals WHERE name = N'$PoolIdentity'"
    $result = & $sqlcmd.Source -S $connectedServer -E -Q $loginCheck -h -1 -W 2>&1
    if ($result -match [regex]::Escape($ApiAppPool)) {
        Write-Ok "SQL login exists: $PoolIdentity"
    }
    else {
        Write-Err "SQL login missing: $PoolIdentity"
        Write-Host ""
        Write-Host "  Run: .\fix-iis-sql.bat" -ForegroundColor Yellow
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
Write-Host "1. Fix SQL automatically:" -ForegroundColor White
Write-Host "   .\fix-iis-sql.bat" -ForegroundColor Gray
Write-Host "2. Redeploy with detected SQL instance:" -ForegroundColor White
Write-Host "   .\deploy-iis.ps1 -SqlServer '.\SQLEXPRESS' -SkipBuild" -ForegroundColor Gray
Write-Host "2. Create SQL login for app pool (see above)" -ForegroundColor White
Write-Host "3. Recycle app pool:" -ForegroundColor White
Write-Host "   Restart-WebAppPool -Name $ApiAppPool" -ForegroundColor Gray
Write-Host "4. Read logs:" -ForegroundColor White
Write-Host "   Get-Content '$LogsPath\stdout*.log' -Tail 50" -ForegroundColor Gray
Write-Host ""
