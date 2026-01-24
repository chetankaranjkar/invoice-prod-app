# Script to diagnose API database connection issues
Write-Host "=== Diagnosing API Database Connection Issue ===" -ForegroundColor Cyan
Write-Host ""

# Check container status
Write-Host "1. Checking container status..." -ForegroundColor Yellow
docker-compose ps
Write-Host ""

# Check if SQL Server is healthy
Write-Host "2. Checking SQL Server container health..." -ForegroundColor Yellow
$sqlserverStatus = docker inspect invoiceapp-db --format='{{.State.Status}}' 2>&1
$sqlserverHealth = docker inspect invoiceapp-db --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>&1
Write-Host "SQL Server Status: $sqlserverStatus" -ForegroundColor $(if ($sqlserverStatus -eq "running") { "Green" } else { "Red" })
Write-Host "SQL Server Health: $sqlserverHealth" -ForegroundColor $(if ($sqlserverHealth -eq "healthy") { "Green" } else { "Yellow" })
Write-Host ""

# Check API logs for database errors
Write-Host "3. Checking API logs for database connection errors..." -ForegroundColor Yellow
$apiLogs = docker-compose logs api --tail=100 2>&1 | Select-String -Pattern "database|sql|connection|error|failed|exception" -Context 1,1
if ($apiLogs) {
    Write-Host $apiLogs -ForegroundColor Red
} else {
    Write-Host "No database-related errors found in recent logs" -ForegroundColor Green
}
Write-Host ""

# Check connection string in API container
Write-Host "4. Checking connection string in API container..." -ForegroundColor Yellow
$connectionString = docker exec invoiceapp-api printenv CONNECTION_STRING 2>&1
if ($connectionString) {
    Write-Host "Connection String: $connectionString" -ForegroundColor Cyan
    # Mask password in output
    $masked = $connectionString -replace 'Password=[^;]+', 'Password=***'
    Write-Host "Masked: $masked" -ForegroundColor Gray
} else {
    Write-Host "[WARNING] CONNECTION_STRING environment variable not found!" -ForegroundColor Red
}
Write-Host ""

# Test network connectivity from API to SQL Server
Write-Host "5. Testing network connectivity from API to SQL Server..." -ForegroundColor Yellow
$pingTest = docker exec invoiceapp-api ping -c 3 sqlserver 2>&1
if ($pingTest -match "3 received" -or $pingTest -match "3 packets") {
    Write-Host "[OK] Network connectivity OK" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Network connectivity failed" -ForegroundColor Red
    Write-Host $pingTest -ForegroundColor Gray
}
Write-Host ""

# Test SQL Server port from API container
Write-Host "6. Testing SQL Server port 1433 from API container..." -ForegroundColor Yellow
$portTest = docker exec invoiceapp-api bash -c "timeout 2 bash -c '</dev/tcp/sqlserver/1433' 2>&1 || echo 'Connection failed'"
if ($portTest -match "Connection failed" -or $portTest -match "timeout") {
    Write-Host "[ERROR] Cannot reach SQL Server on port 1433" -ForegroundColor Red
} else {
    Write-Host "[OK] Port 1433 is accessible" -ForegroundColor Green
}
Write-Host ""

# Check if InvoiceApp database exists
Write-Host "7. Checking if InvoiceApp database exists..." -ForegroundColor Yellow
$sqlcmd = "sqlcmd"
$dbCheck = docker exec invoiceapp-db $sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases WHERE name = 'InvoiceApp'" -h -1 -W 2>&1
if ($dbCheck -match "InvoiceApp") {
    Write-Host "[OK] InvoiceApp database exists" -ForegroundColor Green
} else {
    Write-Host "[WARNING] InvoiceApp database does not exist yet" -ForegroundColor Yellow
    Write-Host "Output: $dbCheck" -ForegroundColor Gray
}
Write-Host ""

# Check API health endpoint
Write-Host "8. Checking API health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:5001/api/Health" -Method Get -TimeoutSec 5
    Write-Host "Health Response:" -ForegroundColor Cyan
    $healthResponse | ConvertTo-Json | Write-Host -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to call health endpoint: $_" -ForegroundColor Red
}
Write-Host ""

# Summary and recommendations
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host ""

if ($sqlserverStatus -ne "running") {
    Write-Host "1. SQL Server is not running. Start it:" -ForegroundColor Yellow
    Write-Host "   docker-compose up -d sqlserver" -ForegroundColor White
    Write-Host "   Wait 60-90 seconds for it to be ready" -ForegroundColor White
    Write-Host ""
}

if ($sqlserverHealth -ne "healthy") {
    Write-Host "2. SQL Server is not healthy. Check logs:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs sqlserver" -ForegroundColor White
    Write-Host ""
}

if ($dbCheck -notmatch "InvoiceApp") {
    Write-Host "3. Database does not exist. Create it:" -ForegroundColor Yellow
    Write-Host "   .\create-database-manually.ps1" -ForegroundColor White
    Write-Host "   OR use SSMS: Connect to localhost,1434 and create 'InvoiceApp' database" -ForegroundColor White
    Write-Host ""
}

Write-Host "4. After fixing issues, restart API:" -ForegroundColor Yellow
Write-Host "   docker-compose restart api" -ForegroundColor White
Write-Host ""
Write-Host "5. Watch logs to verify:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f api" -ForegroundColor White
Write-Host ""
