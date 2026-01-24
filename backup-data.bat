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

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
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

docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123 -Q "BACKUP DATABASE InvoiceApp TO DISK = '/var/opt/mssql/backup/InvoiceApp.bak' WITH FORMAT, INIT, NAME = 'InvoiceApp Full Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"

if errorlevel 1 (
    echo [ERROR] Failed to create database backup
    pause
    exit /b 1
)

REM Copy backup file from container
echo Copying database backup from container...
docker cp invoiceapp-db:/var/opt/mssql/backup/InvoiceApp.bak "%DB_BACKUP_FILE%"

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

REM Check if PowerShell is available for ZIP creation
where powershell >nul 2>&1
if errorlevel 1 (
    echo [WARNING] PowerShell not available. Skipping ZIP creation.
    echo Backup files are in: %BACKUP_PATH%
    echo You can manually ZIP this folder if needed.
) else (
    set ZIP_FILE=%BACKUP_DIR%\%BACKUP_NAME%.zip
    echo Creating ZIP file: %ZIP_FILE%
    
    powershell -Command "Compress-Archive -Path '%BACKUP_PATH%' -DestinationPath '%ZIP_FILE%' -Force"
    
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
