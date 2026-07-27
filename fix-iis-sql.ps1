#Requires -Version 5.1
<#
.SYNOPSIS
    Fix SQL Server connection and app pool permissions for IIS deployment.

.EXAMPLE
    .\fix-iis-sql.ps1
    .\fix-iis-sql.ps1 -SqlServer ".\SQLEXPRESS" -DeployRoot "C:\inetpub\InvoiceApp"
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$SqlServer = "",
    [string]$DatabaseName = "InvoiceApp",
    [string]$ApiAppPool = "InvoiceAppApi"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApiPath = Join-Path $DeployRoot "Api"
$ProdSettings = Join-Path $ApiPath "appsettings.Production.json"
$PoolIdentity = "IIS AppPool\$ApiAppPool"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Test-IsAdministrator {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-SqlCmdPath {
    $candidates = @(
        "sqlcmd",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -eq "sqlcmd") {
            $cmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
            continue
        }
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

function Get-SqlInstanceCandidates {
    $servers = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace($SqlServer)) {
        [void]$servers.Add($SqlServer)
    }

    [void]$servers.Add(".")
    [void]$servers.Add("localhost")
    [void]$servers.Add("(local)")
    [void]$servers.Add(".\SQLEXPRESS")
    [void]$servers.Add("localhost\SQLEXPRESS")
    [void]$servers.Add("$env:COMPUTERNAME\SQLEXPRESS")

    $instanceKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
    if (Test-Path $instanceKey) {
        $props = Get-ItemProperty $instanceKey
        foreach ($prop in $props.PSObject.Properties) {
            if ($prop.Name -in @("PSPath", "PSParentPath", "PSChildName", "PSDrive", "PSProvider")) { continue }
            $instance = [string]$prop.Name
            if ($instance -eq "MSSQLSERVER") {
                [void]$servers.Add(".")
                [void]$servers.Add("localhost")
            }
            else {
                [void]$servers.Add(".\$instance")
                [void]$servers.Add("localhost\$instance")
                [void]$servers.Add("$env:COMPUTERNAME\$instance")
            }
        }
    }

    return $servers | Select-Object -Unique
}

function Start-SqlServices {
    $services = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue
    if (-not $services) {
        return $false
    }

    foreach ($svc in $services) {
        if ($svc.Status -ne "Running") {
            Write-Host "  Starting $($svc.Name)..."
            Start-Service $svc.Name -ErrorAction SilentlyContinue
        }
    }

    $browser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
    if ($browser -and $browser.Status -ne "Running") {
        Write-Host "  Starting SQLBrowser..."
        Start-Service SQLBrowser -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 3
    return $true
}

function Test-SqlConnection {
    param(
        [string]$Server,
        [string]$SqlCmd
    )

    & $SqlCmd -S $Server -E -Q "SELECT 1" -h -1 -W 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Invoke-Sql {
    param(
        [string]$Server,
        [string]$Query,
        [string]$SqlCmd
    )

    & $SqlCmd -S $Server -E -b -Q $Query 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Update-ProductionConnectionString {
    param(
        [string]$Server,
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        Write-Warn "Settings file not found: $Path"
        return
    }

    $connectionString = "Server=$Server;Database=$DatabaseName;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=true"
    $json = Get-Content $Path -Raw | ConvertFrom-Json
    if (-not $json.ConnectionStrings) {
        $json | Add-Member -NotePropertyName ConnectionStrings -NotePropertyValue ([pscustomobject]@{})
    }
    $json.ConnectionStrings.DefaultConnection = $connectionString
    ($json | ConvertTo-Json -Depth 6) | Set-Content $Path -Encoding UTF8
    Write-Ok "Updated connection string in appsettings.Production.json"
}

function Ensure-AppPoolExists {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    if (-not (Test-Path "IIS:\AppPools\$ApiAppPool")) {
        New-WebAppPool -Name $ApiAppPool | Out-Null
        Set-ItemProperty "IIS:\AppPools\$ApiAppPool" -Name managedRuntimeVersion -Value ""
        Write-Ok "Created app pool: $ApiAppPool"
    }

    Start-WebAppPool -Name $ApiAppPool -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# ---------------------------------------------------------------------------
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Invoice Master - Fix SQL for IIS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-IsAdministrator)) {
    Write-Err "Run as Administrator. Use fix-iis-sql.bat"
    exit 1
}

$sqlcmd = Get-SqlCmdPath
if (-not $sqlcmd) {
    Write-Err "sqlcmd not found. Install SSMS or SQL Server Command Line Tools first."
    Write-Host "Download SSMS: https://learn.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms" -ForegroundColor Gray
    exit 1
}
Write-Ok "Using sqlcmd: $sqlcmd"

Write-Step "Starting SQL Server services..."
if (-not (Start-SqlServices)) {
    Write-Err "No SQL Server services found. Install SQL Server Express first."
    Write-Host "Run: .\install-iis-prerequisites.ps1 -IncludeSqlServer" -ForegroundColor Gray
    exit 1
}

Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Status)" -ForegroundColor Gray
}

Write-Step "Detecting SQL Server instance..."
$workingServer = $null
foreach ($candidate in (Get-SqlInstanceCandidates)) {
    Write-Host "  Trying $candidate ..."
    if (Test-SqlConnection -Server $candidate -SqlCmd $sqlcmd) {
        $workingServer = $candidate
        Write-Ok "Connected to SQL Server: $workingServer"
        break
    }
}

if (-not $workingServer) {
    Write-Err "Could not connect to any SQL Server instance."
    Write-Host ""
    Write-Host "Check:" -ForegroundColor Yellow
    Write-Host "  1. SQL Server Express is installed" -ForegroundColor White
    Write-Host "  2. Open SSMS and try connecting to .\SQLEXPRESS or ." -ForegroundColor White
    Write-Host "  3. SQL Server Configuration Manager -> SQL Server Services -> Running" -ForegroundColor White
    exit 1
}

Write-Step "Ensuring IIS app pool exists..."
Ensure-AppPoolExists

Write-Step "Creating SQL login for $PoolIdentity ..."
$escapedPool = $PoolIdentity.Replace("'", "''")
$sqlSetup = @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$escapedPool')
    CREATE LOGIN [$PoolIdentity] FROM WINDOWS;
IF NOT EXISTS (
    SELECT 1
    FROM sys.server_role_members rm
    INNER JOIN sys.server_principals role_p ON rm.role_principal_id = role_p.principal_id
    INNER JOIN sys.server_principals member_p ON rm.member_principal_id = member_p.principal_id
    WHERE role_p.name = N'dbcreator' AND member_p.name = N'$escapedPool'
)
    ALTER SERVER ROLE dbcreator ADD MEMBER [$PoolIdentity];
IF DB_ID(N'$DatabaseName') IS NOT NULL
BEGIN
    USE [$DatabaseName];
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$escapedPool')
        CREATE USER [$PoolIdentity] FOR LOGIN [$PoolIdentity];
    IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members drm
        INNER JOIN sys.database_principals role_p ON drm.role_principal_id = role_p.principal_id
        INNER JOIN sys.database_principals member_p ON drm.member_principal_id = member_p.principal_id
        WHERE role_p.name = N'db_owner' AND member_p.name = N'$escapedPool'
    )
        ALTER ROLE db_owner ADD MEMBER [$PoolIdentity];
END
"@

if (-not (Invoke-Sql -Server $workingServer -Query $sqlSetup -SqlCmd $sqlcmd)) {
    Write-Err "Failed to configure SQL permissions automatically."
    Write-Host ""
    Write-Host "Run manually in SSMS connected to $workingServer :" -ForegroundColor Yellow
    Write-Host "  CREATE LOGIN [$PoolIdentity] FROM WINDOWS;" -ForegroundColor White
    Write-Host "  ALTER SERVER ROLE dbcreator ADD MEMBER [$PoolIdentity];" -ForegroundColor White
    exit 1
}

Write-Ok "SQL permissions configured"

Write-Step "Updating API connection string..."
Update-ProductionConnectionString -Server $workingServer -Path $ProdSettings

Write-Step "Recycling IIS app pool..."
Import-Module WebAdministration -ErrorAction SilentlyContinue
Restart-WebAppPool -Name $ApiAppPool -ErrorAction SilentlyContinue
try { & iisreset | Out-Null } catch { }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " SQL fix complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "SQL Server:  $workingServer" -ForegroundColor White
Write-Host "Database:    $DatabaseName (created on first API start)" -ForegroundColor White
Write-Host "App pool:    $ApiAppPool" -ForegroundColor White
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost" -ForegroundColor White
Write-Host "  2. Or run: .\diagnose-iis-api.ps1 -SqlServer '$workingServer'" -ForegroundColor White
Write-Host ""
