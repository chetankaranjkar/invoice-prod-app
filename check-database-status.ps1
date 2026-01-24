# Script to check database status and create if needed
Write-Host "=== Checking Container Status ===" -ForegroundColor Cyan
docker-compose ps

Write-Host "`n=== Checking API Logs (Database Migration) ===" -ForegroundColor Cyan
docker-compose logs api --tail=100 | Select-String -Pattern "database|migration|InvoiceApp|connection|error|✅|❌" -Context 1,1

Write-Host "`n=== Finding sqlcmd path ===" -ForegroundColor Cyan
$sqlcmdPaths = @("sqlcmd", "/opt/mssql-tools18/bin/sqlcmd", "/opt/mssql-tools/bin/sqlcmd", "/opt/mssql-tools17/bin/sqlcmd")
$sqlcmd = "sqlcmd"
foreach ($path in $sqlcmdPaths) {
    $test = docker exec invoiceapp-db which $path 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $test -notmatch "not found" -and $test.Trim() -ne "") {
        $sqlcmd = $path
        break
    }
}
Write-Host "Using sqlcmd at: $sqlcmd" -ForegroundColor Green

Write-Host "`n=== Checking if InvoiceApp database exists ===" -ForegroundColor Cyan
docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases WHERE name = 'InvoiceApp'" -h -1 -W 2>&1

Write-Host "`n=== Listing all databases ===" -ForegroundColor Cyan
docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases" -h -1 -W 2>&1
