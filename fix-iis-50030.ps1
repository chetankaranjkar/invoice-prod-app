#Requires -Version 5.1
<#
.SYNOPSIS
    Fix 500.30 caused by wrong SQL instance (.\SQLEXPRESS vs default .).
#>
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$ApiAppPool = "InvoiceAppApi"
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Host "[ERROR] Run as Administrator: fix-iis-50030.bat" -ForegroundColor Red
    exit 1
}

function Get-SqlCmdPath {
    $c = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    @(
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Test-Sql([string]$Server, [string]$SqlCmd) {
    & $SqlCmd -S $Server -E -Q "SELECT 1" -h -1 -W 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Fix IIS 500.30 (SQL connection)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$sqlcmd = Get-SqlCmdPath
if (-not $sqlcmd) {
    Write-Host "[ERROR] sqlcmd not found. Install SSMS." -ForegroundColor Red
    exit 1
}

# Prefer running services: default instance first if MSSQLSERVER is running
$candidates = @()
$svcDefault = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue
$svcExpress = Get-Service -Name "MSSQL`$SQLEXPRESS" -ErrorAction SilentlyContinue
if ($svcDefault -and $svcDefault.Status -eq "Running") {
    $candidates += ".", "localhost", "(local)"
}
if ($svcExpress -and $svcExpress.Status -eq "Running") {
    $candidates += ".\SQLEXPRESS", "localhost\SQLEXPRESS"
}
$candidates += ".", ".\SQLEXPRESS", "localhost", "localhost\SQLEXPRESS"
$candidates = $candidates | Select-Object -Unique

$server = $null
foreach ($c in $candidates) {
    Write-Host "  Trying $c ..."
    if (Test-Sql -Server $c -SqlCmd $sqlcmd) {
        $server = $c
        Write-Host "[OK] Connected to $server" -ForegroundColor Green
        break
    }
}

if (-not $server) {
    Write-Host "[ERROR] Cannot connect to SQL Server. Start MSSQLSERVER or MSSQL`$SQLEXPRESS." -ForegroundColor Red
    Get-Service MSSQL* | Format-Table Name, Status -AutoSize
    exit 1
}

$pool = "IIS AppPool\$ApiAppPool"
$q = @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$pool')
    CREATE LOGIN [$pool] FROM WINDOWS;
IF NOT EXISTS (
    SELECT 1 FROM sys.server_role_members rm
    INNER JOIN sys.server_principals r ON rm.role_principal_id = r.principal_id
    INNER JOIN sys.server_principals m ON rm.member_principal_id = m.principal_id
    WHERE r.name = N'dbcreator' AND m.name = N'$pool')
    ALTER SERVER ROLE dbcreator ADD MEMBER [$pool];
IF DB_ID(N'InvoiceApp') IS NOT NULL
BEGIN
    USE [InvoiceApp];
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$pool')
        CREATE USER [$pool] FOR LOGIN [$pool];
    IF NOT EXISTS (
        SELECT 1 FROM sys.database_role_members drm
        INNER JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
        INNER JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
        WHERE r.name = N'db_owner' AND m.name = N'$pool')
        ALTER ROLE db_owner ADD MEMBER [$pool];
END
"@
& $sqlcmd -S $server -E -b -Q $q | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed creating SQL login for $pool" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] SQL login ready: $pool" -ForegroundColor Green

$prod = Join-Path $DeployRoot "Api\appsettings.Production.json"
if (-not (Test-Path $prod)) {
    Write-Host "[ERROR] Missing $prod - run deploy-iis.ps1 first" -ForegroundColor Red
    exit 1
}

$conn = "Server=$server;Database=InvoiceApp;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=true"
$json = Get-Content $prod -Raw | ConvertFrom-Json
$json.ConnectionStrings.DefaultConnection = $conn
($json | ConvertTo-Json -Depth 6) | Set-Content $prod -Encoding UTF8
Write-Host "[OK] Updated connection string: $conn" -ForegroundColor Green

Import-Module WebAdministration
Restart-WebAppPool -Name $ApiAppPool
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "Waiting for API health (DB may create on first start)..." -ForegroundColor Yellow
$ok = $false
for ($i = 1; $i -le 40; $i++) {
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:5001/health" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) {
            Write-Host "[OK] API healthy: $($r.Content)" -ForegroundColor Green
            $ok = $true
            break
        }
    }
    catch {
        Write-Host "  Attempt $i/40..."
        Start-Sleep -Seconds 3
    }
}

if (-not $ok) {
    Write-Host "[WARN] API still not healthy. Check Event Viewer > Application for AspNetCore Module errors." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Open http://localhost" -ForegroundColor Green
