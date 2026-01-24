# Script to manually create the InvoiceApp database if it doesn't exist
Write-Host "Creating InvoiceApp database manually..." -ForegroundColor Cyan
Write-Host ""

# Method 1: Try using sqlcmd directly (SQL Server 2022 has it in PATH)
Write-Host "Method 1: Trying sqlcmd directly..." -ForegroundColor Yellow
$result1 = docker exec invoiceapp-db sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'InvoiceApp') CREATE DATABASE InvoiceApp;" 2>&1
$sqlcmd = $null
$dbCreated = $false

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Database created successfully using sqlcmd!" -ForegroundColor Green
    $sqlcmd = "sqlcmd"
    $dbCreated = $true
} else {
    # Method 2: Try /opt/mssql-tools18/bin/sqlcmd (SQL Server 2022)
    Write-Host "Method 2: Trying /opt/mssql-tools18/bin/sqlcmd..." -ForegroundColor Yellow
    $result2 = docker exec invoiceapp-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'InvoiceApp') CREATE DATABASE InvoiceApp;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database created successfully!" -ForegroundColor Green
        $sqlcmd = "/opt/mssql-tools18/bin/sqlcmd"
        $dbCreated = $true
    } else {
        # Method 3: Try /opt/mssql-tools/bin/sqlcmd (older versions)
        Write-Host "Method 3: Trying /opt/mssql-tools/bin/sqlcmd..." -ForegroundColor Yellow
        $result3 = docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'InvoiceApp') CREATE DATABASE InvoiceApp;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Database created successfully!" -ForegroundColor Green
            $sqlcmd = "/opt/mssql-tools/bin/sqlcmd"
            $dbCreated = $true
        }
    }
}

if (-not $dbCreated) {
    # All automated methods failed - provide manual instructions
    Write-Host "[ERROR] All automated methods failed. Please create database manually:" -ForegroundColor Red
    Write-Host ""
    Write-Host "Option 1: Using SSMS (Recommended)" -ForegroundColor Yellow
    Write-Host "  1. Connect to localhost,1434 in SQL Server Management Studio" -ForegroundColor White
    Write-Host "  2. Right-click 'Databases' > 'New Database'" -ForegroundColor White
    Write-Host "  3. Name: InvoiceApp" -ForegroundColor White
    Write-Host "  4. Click OK" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Using SQL Command in SSMS" -ForegroundColor Yellow
    Write-Host "  Run this SQL:" -ForegroundColor White
    Write-Host "  CREATE DATABASE InvoiceApp;" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then restart the API to apply migrations:" -ForegroundColor Yellow
    Write-Host "  docker-compose restart api" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Verify database exists
Write-Host ""
Write-Host "Verifying database exists..." -ForegroundColor Cyan

if ($sqlcmd) {
    $verify = docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases WHERE name = 'InvoiceApp'" -h -1 -W 2>&1
    
    if ($verify -match "InvoiceApp") {
        Write-Host "[OK] InvoiceApp database verified!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Restart API container to apply migrations:" -ForegroundColor White
        Write-Host "   docker-compose restart api" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. Watch logs to verify migrations:" -ForegroundColor White
        Write-Host "   docker-compose logs -f api" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. Verify tables were created:" -ForegroundColor White
        Write-Host "   .\verify-database-created.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "[WARNING] Database verification unclear. Output:" -ForegroundColor Yellow
        Write-Host $verify -ForegroundColor Gray
        Write-Host ""
        Write-Host "Please check in SSMS (localhost,1434) if InvoiceApp database exists." -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARNING] Could not verify - sqlcmd path not found" -ForegroundColor Yellow
    Write-Host "Please verify database in SSMS (localhost,1434)" -ForegroundColor Yellow
}
