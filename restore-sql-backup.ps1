#Requires -Version 5.1
<#
.SYNOPSIS
    Restore a .bak file (e.g. from Docker SQL) onto local SQL Server / SQL Express (IIS).

.DESCRIPTION
    Avoids the SSMS sector-size error (512 vs 4096) by copying the .bak to a NEW file name
  on a staging folder before RESTORE. Also handles logical file MOVE paths.

.EXAMPLE
    .\restore-sql-backup.ps1 -BackupFile "D:\Downloads\InvoiceApp.bak"
    .\restore-sql-backup.ps1 -SqlServer ".\SQLEXPRESS" -Database "InvoiceApp" -BackupFile "C:\temp\docker.bak"
#>

[CmdletBinding()]
param(
    [string]$SqlServer = ".\SQLEXPRESS",
    [string]$Database = "InvoiceApp",
    [Parameter(Mandatory)]
    [string]$BackupFile,
    [string]$StagingDir = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Err([string]$Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

if (-not (Test-Path $BackupFile)) {
    Write-Err "Backup file not found: $BackupFile"
    exit 1
}

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
    Write-Err "sqlcmd not found. Install SQL Server Command Line Utilities or use SSMS with the steps in BACKUP_RESTORE_GUIDE.md"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($StagingDir)) {
    $StagingDir = Join-Path $env:TEMP "InvoiceAppSqlRestore"
}
if (-not (Test-Path $StagingDir)) {
    New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
}

$stagedBackup = Join-Path $StagingDir ("restore_{0:yyyyMMdd_HHmmss}_{1}.bak" -f (Get-Date), ([Guid]::NewGuid().ToString("N").Substring(0, 8)))
Write-Step "Copying backup to staging file (avoids sector-size conflict)..."
Copy-Item -LiteralPath $BackupFile -Destination $stagedBackup -Force
Write-Ok "Staged at $stagedBackup"

function Invoke-Sql([string]$Query) {
    $escaped = $stagedBackup.Replace("'", "''")
    $q = $Query.Replace('{{BAK}}', $escaped)
    $out = & sqlcmd -S $SqlServer -E -b -h -1 -W -Q $q 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($out -join "`n")
    }
    return $out
}

Write-Step "Reading logical file names from backup..."
$fileListRaw = & sqlcmd -S $SqlServer -E -b -Q "RESTORE FILELISTONLY FROM DISK = N'$($stagedBackup.Replace("'", "''"))';" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err ($fileListRaw -join "`n")
    exit 1
}

# Parse FILELISTONLY output (skip header lines; columns: LogicalName, PhysicalName, Type, ...)
$rows = @()
foreach ($line in ($fileListRaw | Where-Object { $_ -and $_ -notmatch '^-+$' -and $_ -notmatch 'LogicalName' })) {
    $parts = ($line -split '\s{2,}') | Where-Object { $_ }
    if ($parts.Count -ge 3) {
        $rows += [pscustomobject]@{
            LogicalName = $parts[0].Trim()
            PhysicalName = $parts[1].Trim()
            Type = $parts[2].Trim()
        }
    }
}

if ($rows.Count -eq 0) {
    Write-Err "Could not parse RESTORE FILELISTONLY output. Open SSMS and run RESTORE FILELISTONLY manually."
    $fileListRaw | ForEach-Object { Write-Host $_ }
    exit 1
}

Write-Ok "Logical files: $($rows.LogicalName -join ', ')"

# Default data/log paths for this instance
$defaultData = & sqlcmd -S $SqlServer -E -h -1 -W -Q "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260));" 2>&1 | Select-Object -Last 1
$defaultLog = & sqlcmd -S $SqlServer -E -h -1 -W -Q "SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(260));" 2>&1 | Select-Object -Last 1
$defaultData = $defaultData.Trim()
$defaultLog = $defaultLog.Trim()
if (-not $defaultData) { $defaultData = "C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\" }
if (-not $defaultLog) { $defaultLog = $defaultData }

$moveClauses = @()
foreach ($row in $rows) {
    $ext = if ($row.Type -eq 'L') { '.ldf' } else { '.mdf' }
    if ($row.Type -eq 'L') {
        $target = Join-Path $defaultLog ($Database + "_log" + $ext)
    }
    else {
        $target = Join-Path $defaultData ($Database + $ext)
    }
    $moveClauses += "MOVE N'$($row.LogicalName)' TO N'$($target.Replace("'", "''"))'"
}

$dbExists = & sqlcmd -S $SqlServer -E -h -1 -W -Q "SELECT COUNT(*) FROM sys.databases WHERE name = N'$($Database.Replace("'", "''"))';" 2>&1 | Select-Object -Last 1
$dbExists = [int]($dbExists.Trim())

if ($dbExists -gt 0 -and -not $Force) {
    Write-Host ""
    Write-Warning "Database '$Database' already exists. Re-run with -Force to replace it."
    exit 1
}

Write-Step "Restoring database '$Database'..."
if ($dbExists -gt 0) {
    Invoke-Sql "ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;" | Out-Null
}

$restoreSql = @"
RESTORE DATABASE [$Database]
FROM DISK = N'{{BAK}}'
WITH REPLACE, $($moveClauses -join ', '), STATS = 10;
"@

try {
    Invoke-Sql $restoreSql | Out-Null
    if ($dbExists -gt 0) {
        Invoke-Sql "ALTER DATABASE [$Database] SET MULTI_USER;" | Out-Null
    }
}
catch {
    Write-Err $_.Exception.Message
    exit 1
}

Write-Ok "Database '$Database' restored successfully from Docker/legacy backup."
Write-Host ""
Write-Host "Next: restart the InvoiceApp API app pool, then open the web app." -ForegroundColor Green
