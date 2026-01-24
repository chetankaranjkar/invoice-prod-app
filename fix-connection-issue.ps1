# Script to fix SQL Server connection issue
Write-Host "=== Fixing SQL Server Connection Issue ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check current status
Write-Host "Step 1: Checking current container status..." -ForegroundColor Yellow
docker-compose ps
Write-Host ""

# Step 2: Stop everything
Write-Host "Step 2: Stopping all containers..." -ForegroundColor Yellow
docker-compose down
Write-Host ""

# Step 3: Start SQL Server first and wait
Write-Host "Step 3: Starting SQL Server..." -ForegroundColor Yellow
docker-compose up -d sqlserver
Write-Host ""

Write-Host "Waiting 90 seconds for SQL Server to be fully ready..." -ForegroundColor Yellow
Write-Host "This is important - SQL Server needs time to initialize" -ForegroundColor Gray
for ($i = 90; $i -gt 0; $i--) {
    Write-Host "`rWaiting $i seconds..." -NoNewline -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
Write-Host "`rWaiting complete!                                  " -ForegroundColor Green
Write-Host ""

# Step 4: Check SQL Server health
Write-Host "Step 4: Checking SQL Server health..." -ForegroundColor Yellow
$health = docker inspect invoiceapp-db --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>&1
Write-Host "SQL Server Status: $health" -ForegroundColor $(if ($health -eq "healthy") { "Green" } else { "Yellow" })
Write-Host ""

if ($health -ne "healthy") {
    Write-Host "[WARNING] SQL Server is not healthy yet. Waiting additional 30 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    $health = docker inspect invoiceapp-db --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>&1
    Write-Host "SQL Server Status after additional wait: $health" -ForegroundColor $(if ($health -eq "healthy") { "Green" } else { "Red" })
    Write-Host ""
}

# Step 5: Test SQL Server connection from host
Write-Host "Step 5: Testing SQL Server connection..." -ForegroundColor Yellow
$testConnection = docker exec invoiceapp-db sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION" -h -1 -W 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] SQL Server is accepting connections" -ForegroundColor Green
} else {
    Write-Host "[WARNING] SQL Server might not be fully ready" -ForegroundColor Yellow
    Write-Host "Output: $testConnection" -ForegroundColor Gray
}
Write-Host ""

# Step 6: Rebuild API to include latest retry logic
Write-Host "Step 6: Rebuilding API container with latest code..." -ForegroundColor Yellow
Write-Host "This ensures the retry logic and database creation code is included" -ForegroundColor Gray
docker-compose build --no-cache api
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to build API container" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] API container built successfully" -ForegroundColor Green
Write-Host ""

# Step 7: Start API
Write-Host "Step 7: Starting API container..." -ForegroundColor Yellow
docker-compose up -d api
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start API container" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] API container started" -ForegroundColor Green
Write-Host ""

# Step 8: Wait for API to initialize
Write-Host "Step 8: Waiting for API to initialize and create database (this may take 2-3 minutes)..." -ForegroundColor Yellow
Write-Host "Watching API logs..." -ForegroundColor Gray
Write-Host ""

# Show recent logs
Start-Sleep -Seconds 10
docker-compose logs api --tail=50
Write-Host ""
Write-Host "Waiting additional 60 seconds for database creation..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# Step 9: Check if database was created
Write-Host ""
Write-Host "Step 9: Checking if database was created..." -ForegroundColor Yellow
docker-compose logs api | Select-String -Pattern "InvoiceApp database|Database migrations applied|Database healthy|connection successful" | Select-Object -Last 10
Write-Host ""

# Step 10: Start Frontend
Write-Host "Step 10: Starting Frontend..." -ForegroundColor Yellow
docker-compose up -d frontend
Write-Host ""

# Final status
Write-Host "=== Final Status ===" -ForegroundColor Cyan
docker-compose ps
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Check API logs for database creation:" -ForegroundColor Yellow
Write-Host "   docker-compose logs api --tail=100" -ForegroundColor White
Write-Host ""
Write-Host "2. Test health endpoint:" -ForegroundColor Yellow
Write-Host "   curl http://localhost:5001/api/Health" -ForegroundColor White
Write-Host ""
Write-Host "3. If database still not created, check logs for errors:" -ForegroundColor Yellow
Write-Host "   docker-compose logs api | Select-String -Pattern 'error|failed|exception'" -ForegroundColor White
Write-Host ""
Write-Host "4. Access application:" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost" -ForegroundColor White
Write-Host "   API Swagger: http://localhost:5001/swagger" -ForegroundColor White
Write-Host ""
