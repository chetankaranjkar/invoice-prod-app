@echo off
echo ========================================
echo Invoice App - Data Backup
echo ========================================
echo.
echo This script will create a backup of:
echo   1. Database (SQL Server backup file)
echo   2. Uploaded files (logos, etc.)
echo.
echo The backup will be saved as a ZIP file with timestamp.
echo.

cd /d "%~dp0"

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running or containers are not started
    echo Please start the application first: docker-compose up -d
    pause
    exit /b 1
)

REM Check if containers are running
docker-compose ps | findstr /C:"invoiceapp-db" | findstr /C:"Up" >nul
if errorlevel 1 (
    echo [ERROR] Database container is not running
    echo Please start the application first: docker-compose up -d
    pause
    exit /b 1
)

REM Create backup directory
set BACKUP_DIR=backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Generate timestamp (PowerShell — wmic removed on Windows 11+)
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set TIMESTAMP=%%I
set BACKUP_NAME=invoiceapp-backup-%TIMESTAMP%
set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_NAME%

echo Creating backup directory: %BACKUP_PATH%
if not exist "%BACKUP_PATH%" mkdir "%BACKUP_PATH%"
if not exist "%BACKUP_PATH%\database" mkdir "%BACKUP_PATH%\database"
if not exist "%BACKUP_PATH%\uploads" mkdir "%BACKUP_PATH%\uploads"

echo.
echo ========================================
echo Step 1: Backing up database...
echo ========================================
echo.

REM Create database backup
set DB_BACKUP_FILE=%BACKUP_PATH%\database\InvoiceApp.bak
echo Creating database backup: %DB_BACKUP_FILE%

REM Ensure backup folder exists in SQL container (shared volume)
docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup" >nul 2>&1

REM Detect sqlcmd path (SQL Server 2022 uses mssql-tools18 or PATH sqlcmd)
set SQLCMD=
docker exec invoiceapp-db sqlcmd -S localhost -U sa -P YourStrong@Password123 -C -Q "SELECT 1" >nul 2>&1
if not errorlevel 1 set SQLCMD=sqlcmd
if "%SQLCMD%"=="" (
    docker exec invoiceapp-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123 -C -Q "SELECT 1" >nul 2>&1
    if not errorlevel 1 set SQLCMD=/opt/mssql-tools18/bin/sqlcmd
)
if "%SQLCMD%"=="" (
    docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123 -Q "SELECT 1" >nul 2>&1
    if not errorlevel 1 set SQLCMD=/opt/mssql-tools/bin/sqlcmd
)
if "%SQLCMD%"=="" (
    echo [ERROR] sqlcmd not found in invoiceapp-db container
    echo Try backup from the app: Backup ^& Restore page in the browser
    pause
    exit /b 1
)

set SQLCMD_TRUST=
if "%SQLCMD%"=="sqlcmd" set SQLCMD_TRUST=-C
if "%SQLCMD%"=="/opt/mssql-tools18/bin/sqlcmd" set SQLCMD_TRUST=-C

echo Using sqlcmd: %SQLCMD%
set CONTAINER_BAK=/var/opt/mssql/backup/InvoiceApp.bak
docker exec invoiceapp-db %SQLCMD% -S localhost -U sa -P YourStrong@Password123 %SQLCMD_TRUST% -Q "BACKUP DATABASE InvoiceApp TO DISK = '/var/opt/mssql/backup/InvoiceApp.bak' WITH FORMAT, INIT, NAME = 'InvoiceApp Full Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
if errorlevel 1 goto try_backup_data_dir
goto backup_db_ok

:try_backup_data_dir
echo [WARNING] Backup to shared folder failed, trying SQL data directory...
set CONTAINER_BAK=/var/opt/mssql/data/InvoiceApp.bak
docker exec invoiceapp-db %SQLCMD% -S localhost -U sa -P YourStrong@Password123 %SQLCMD_TRUST% -Q "BACKUP DATABASE InvoiceApp TO DISK = '/var/opt/mssql/data/InvoiceApp.bak' WITH FORMAT, INIT, NAME = 'InvoiceApp Full Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
if errorlevel 1 (
    echo [ERROR] Failed to create database backup
    echo Run fix-backup-permissions.bat or use Backup ^& Restore in the browser
    pause
    exit /b 1
)

:backup_db_ok
REM Copy backup file from container
echo Copying database backup from container...
docker cp invoiceapp-db:%CONTAINER_BAK% "%DB_BACKUP_FILE%"

if errorlevel 1 (
    echo [ERROR] Failed to copy database backup
    pause
    exit /b 1
)

echo [OK] Database backup created successfully
echo.

echo ========================================
echo Step 2: Backing up uploaded files...
echo ========================================
echo.

REM Copy uploaded files from volume
echo Copying uploaded files from Docker volume...
docker run --rm -v invoiceapp_api_uploads:/source -v "%CD%\%BACKUP_PATH%\uploads:/dest" alpine sh -c "cp -r /source/* /dest/ 2>/dev/null || true"

if errorlevel 1 (
    echo [WARNING] Some files may not have been copied
) else (
    echo [OK] Uploaded files backed up successfully
)
echo.

echo ========================================
echo Step 3: Creating ZIP archive...
echo ========================================
echo.

REM Set ZIP path before if/else — batch does not expand vars set inside ( ) blocks
set ZIP_FILE=%BACKUP_DIR%\%BACKUP_NAME%.zip

REM Check if PowerShell is available for ZIP creation
where powershell >nul 2>&1
if errorlevel 1 (
    echo [WARNING] PowerShell not available. Skipping ZIP creation.
    echo Backup files are in: %BACKUP_PATH%
    echo You can manually ZIP this folder if needed.
) else (
    echo Creating ZIP file: %ZIP_FILE%
    
    powershell -NoProfile -Command "Compress-Archive -LiteralPath '%BACKUP_PATH%' -DestinationPath '%ZIP_FILE%' -Force"
    
    if errorlevel 1 (
        echo [WARNING] Failed to create ZIP file. Backup files are in: %BACKUP_PATH%
    ) else (
        echo [OK] ZIP file created: %ZIP_FILE%
        
        REM Remove temporary backup directory
        echo Cleaning up temporary files...
        rd /s /q "%BACKUP_PATH%"
        echo [OK] Cleanup complete
    )
)

echo.
echo ========================================
echo Backup Complete!
echo ========================================
echo.
if exist "%ZIP_FILE%" (
    for %%F in ("%ZIP_FILE%") do (
        echo Backup file: %ZIP_FILE%
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1MB, 2)"') do echo File size: %%A MB
    )
) else (
    echo Backup directory: %BACKUP_PATH%
    echo You can manually ZIP this folder if needed.
)
echo.
echo Backup includes:
echo   - Database backup (InvoiceApp.bak)
echo   - Uploaded files (logos, etc.)
echo.
echo To restore this backup, use: restore-data.bat
echo.
pause
