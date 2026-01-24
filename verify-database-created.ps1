# Script to verify InvoiceApp database was created and has tables
Write-Host "=== Verifying InvoiceApp Database ===" -ForegroundColor Cyan
Write-Host ""

# Find sqlcmd path
$sqlcmdPaths = @("sqlcmd", "/opt/mssql-tools18/bin/sqlcmd", "/opt/mssql-tools/bin/sqlcmd", "/opt/mssql-tools17/bin/sqlcmd")
$sqlcmd = $null

foreach ($path in $sqlcmdPaths) {
    Write-Host "Trying sqlcmd path: $path" -ForegroundColor Gray
    $result = docker exec invoiceapp-db which $path 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $result.Trim() -ne "" -and $result -notmatch "not found") {
        $sqlcmd = $path
        Write-Host "[OK] Found sqlcmd at: $path" -ForegroundColor Green
        break
    }
    # Try direct execution
    $test = docker exec invoiceapp-db $path -? 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $test -match "usage|sqlcmd") {
        $sqlcmd = $path
        Write-Host "[OK] Found sqlcmd at: $path (via direct test)" -ForegroundColor Green
        break
    }
}

if (-not $sqlcmd) {
    Write-Host "[ERROR] Could not find sqlcmd in container" -ForegroundColor Red
    Write-Host "Trying to list available commands..." -ForegroundColor Yellow
    docker exec invoiceapp-db ls -la /opt/mssql-tools*/bin/ 2>&1
    exit 1
}

Write-Host ""
Write-Host "=== Checking if InvoiceApp database exists ===" -ForegroundColor Cyan
$dbCheck = docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases WHERE name = 'InvoiceApp'" -h -1 -W -s "," 2>&1

if ($dbCheck -match "InvoiceApp") {
    Write-Host "[OK] InvoiceApp database exists!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] InvoiceApp database does not exist!" -ForegroundColor Red
    Write-Host "Output: $dbCheck" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To create the database manually:" -ForegroundColor Yellow
    Write-Host "1. Connect to localhost,1434 in SSMS" -ForegroundColor White
    Write-Host "2. Run: CREATE DATABASE InvoiceApp;" -ForegroundColor White
    Write-Host "3. Then run: docker-compose restart api" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== Checking if tables exist ===" -ForegroundColor Cyan
$tablesCheck = docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -d InvoiceApp -Q "SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'" -h -1 -W -s "," 2>&1

if ($tablesCheck -match "\d+") {
    Write-Host "[OK] Database has tables" -ForegroundColor Green
    Write-Host "Table count: $tablesCheck" -ForegroundColor Gray
} else {
    Write-Host "[WARNING] No tables found or migration not applied yet" -ForegroundColor Yellow
    Write-Host "Output: $tablesCheck" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Restart API to apply migrations:" -ForegroundColor Yellow
    Write-Host "docker-compose restart api" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Checking if Users table exists and has data ===" -ForegroundColor Cyan
$usersCheck = docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -d InvoiceApp -Q "SELECT COUNT(*) as UserCount FROM Users" -h -1 -W -s "," 2>&1

if ($usersCheck -match "\d+") {
    Write-Host "[OK] Users table exists" -ForegroundColor Green
    if ($usersCheck -match "(\d+)") {
        $count = $matches[1]
        if ([int]$count -gt 0) {
            Write-Host "[OK] Database has $count user(s) - seeding was successful!" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Users table is empty - seeding may not have completed" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[WARNING] Users table may not exist yet" -ForegroundColor Yellow
    Write-Host "Output: $usersCheck" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Listing all databases ===" -ForegroundColor Cyan
docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases" -h -1 -W 2>&1

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$summary = @{
    "Database Exists" = if ($dbCheck -match "InvoiceApp") { "[OK]" } else { "[ERROR]" }
    "Tables Created" = if ($tablesCheck -match "\d+" -and $tablesCheck -notmatch "0") { "[OK]" } else { "[WARNING]" }
    "Data Seeded" = if ($usersCheck -match "\d+" -and [int]($usersCheck -replace '\D','') -gt 0) { "[OK]" } else { "[WARNING]" }
}

foreach ($key in $summary.Keys) {
    Write-Host "$key : $($summary[$key])" -ForegroundColor $(if ($summary[$key] -match "OK") { "Green" } elseif ($summary[$key] -match "ERROR") { "Red" } else { "Yellow" })
}
