# Script to fix backup directory permissions in SQL Server container
# Run this after starting the containers

Write-Host "Fixing backup directory permissions in SQL Server container..." -ForegroundColor Yellow

# Create backup directory and set permissions
docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup directory permissions fixed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to fix permissions. You may need to run this manually." -ForegroundColor Red
    Write-Host "Manual command:" -ForegroundColor Yellow
    Write-Host "  docker exec invoiceapp-db bash -c 'mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup'" -ForegroundColor Cyan
}
