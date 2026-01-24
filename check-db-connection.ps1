# Script to check SQL Server connection from API container
Write-Host "Checking SQL Server container status..." -ForegroundColor Cyan
docker-compose ps sqlserver

Write-Host "`nChecking if SQL Server is accepting connections..." -ForegroundColor Cyan
$sqlcmd = "sqlcmd"
if (docker exec invoiceapp-db which sqlcmd 2>&1 | Out-String | Select-String -Pattern "not found") {
    $sqlcmd = "/opt/mssql-tools18/bin/sqlcmd"
}
docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION" 2>&1

Write-Host "`nTesting connection from API container..." -ForegroundColor Cyan
docker exec invoiceapp-api dotnet exec InvoiceApp.Api.dll --test-db-connection 2>&1 || Write-Host "API container may not have a test command. Checking logs instead..." -ForegroundColor Yellow

Write-Host "`nRecent API logs (database connection attempts):" -ForegroundColor Cyan
docker-compose logs api --tail=50 | Select-String -Pattern "database|sql|connection|error" -Context 2,2

Write-Host "`nRecent SQL Server logs:" -ForegroundColor Cyan
docker-compose logs sqlserver --tail=30
