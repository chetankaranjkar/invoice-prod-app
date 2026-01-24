# Script to diagnose SQL Server connection issue
Write-Host "=== Diagnosing SQL Server Connection Issue ===" -ForegroundColor Cyan
Write-Host ""

# Check container status
Write-Host "1. Checking container status..." -ForegroundColor Yellow
docker-compose ps
Write-Host ""

# Check SQL Server container specifically
Write-Host "2. Checking SQL Server container details..." -ForegroundColor Yellow
docker inspect invoiceapp-db --format='Status: {{.State.Status}}, Health: {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>&1
Write-Host ""

# Check SQL Server logs
Write-Host "3. Recent SQL Server logs..." -ForegroundColor Yellow
docker-compose logs sqlserver --tail=30
Write-Host ""

# Test network connectivity from API to SQL Server
Write-Host "4. Testing network connectivity from API to SQL Server..." -ForegroundColor Yellow
$pingTest = docker exec invoiceapp-api ping -c 3 sqlserver 2>&1
Write-Host $pingTest
Write-Host ""

# Check if SQL Server port is accessible from API container
Write-Host "5. Testing SQL Server port 1433 from API container..." -ForegroundColor Yellow
$portTest = docker exec invoiceapp-api bash -c "timeout 2 bash -c '</dev/tcp/sqlserver/1433' 2>&1 || echo 'Port 1433 not accessible'" 2>&1
Write-Host $portTest
Write-Host ""

# Check connection string in API container
Write-Host "6. Checking connection string in API container..." -ForegroundColor Yellow
$connStr = docker exec invoiceapp-api printenv CONNECTION_STRING 2>&1
Write-Host "Connection String: $connStr" -ForegroundColor Cyan
Write-Host ""

# Check if sqlserver hostname resolves in API container
Write-Host "7. Checking DNS resolution in API container..." -ForegroundColor Yellow
$dnsTest = docker exec invoiceapp-api nslookup sqlserver 2>&1 | Select-String -Pattern "Name|Address" -Context 0,2
if ($dnsTest) {
    Write-Host $dnsTest -ForegroundColor Green
} else {
    Write-Host "DNS resolution test failed or nslookup not available" -ForegroundColor Yellow
    # Try alternative
    $pingTest2 = docker exec invoiceapp-api getent hosts sqlserver 2>&1
    Write-Host "Hosts lookup: $pingTest2"
}
Write-Host ""

# Summary
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If SQL Server is not running:" -ForegroundColor Yellow
Write-Host "  docker-compose up -d sqlserver" -ForegroundColor White
Write-Host "  Wait 90 seconds for it to be ready" -ForegroundColor White
Write-Host ""
Write-Host "If containers are running but can't connect:" -ForegroundColor Yellow
Write-Host "  1. Restart both containers:" -ForegroundColor White
Write-Host "     docker-compose restart sqlserver api" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Check network:" -ForegroundColor White
Write-Host "     docker network inspect invoiceapp_invoiceapp-network" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Rebuild and restart:" -ForegroundColor White
Write-Host "     docker-compose down" -ForegroundColor Cyan
Write-Host "     docker-compose build api" -ForegroundColor Cyan
Write-Host "     docker-compose up -d" -ForegroundColor Cyan
Write-Host ""
