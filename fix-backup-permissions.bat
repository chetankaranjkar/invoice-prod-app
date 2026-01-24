@echo off
echo Fixing backup directory permissions in SQL Server container...
echo.

docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup"

if errorlevel 1 (
    echo [ERROR] Failed to fix permissions
    echo.
    echo Manual command:
    echo   docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup"
) else (
    echo [OK] Backup directory permissions fixed successfully!
)

pause
