@echo off
echo ========================================
echo Invoice App - Data Restore
echo ========================================
echo.
echo This script will restore data from a backup file.
echo.
echo WARNING: This will REPLACE all existing data!
echo          Make sure you have a current backup before proceeding.
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

REM Check for backup files
set BACKUP_DIR=backups
if not exist "%BACKUP_DIR%" (
    echo [ERROR] Backups directory not found: %BACKUP_DIR%
    pause
    exit /b 1
)

echo Available backup files:
echo.
dir /b "%BACKUP_DIR%\*.zip" 2>nul
if errorlevel 1 (
    echo [INFO] No ZIP files found. Checking for backup directories...
    dir /b /ad "%BACKUP_DIR%" 2>nul
)
echo.

set /p BACKUP_FILE="Enter backup file name (ZIP) or directory name: "

if "%BACKUP_FILE%"=="" (
    echo [ERROR] No backup file specified
    pause
    exit /b 1
)

REM Check if it's a ZIP file or directory
set BACKUP_PATH=
if exist "%BACKUP_DIR%\%BACKUP_FILE%.zip" (
    set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_FILE%.zip
    set IS_ZIP=1
) else if exist "%BACKUP_DIR%\%BACKUP_FILE%" (
    set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_FILE%
    set IS_ZIP=0
) else if exist "%BACKUP_FILE%" (
    set BACKUP_PATH=%BACKUP_FILE%
    if "%BACKUP_FILE:~-4%"==".zip" (
        set IS_ZIP=1
    ) else (
        set IS_ZIP=0
    )
) else (
    echo [ERROR] Backup file not found: %BACKUP_FILE%
    pause
    exit /b 1
)

echo.
echo Backup file: %BACKUP_PATH%
echo.

REM Extract ZIP if needed
set RESTORE_TEMP=%TEMP%\invoiceapp-restore-%RANDOM%
if "%IS_ZIP%"=="1" (
    echo Extracting ZIP file...
    if not exist "%RESTORE_TEMP%" mkdir "%RESTORE_TEMP%"
    
    powershell -Command "Expand-Archive -Path '%BACKUP_PATH%' -DestinationPath '%RESTORE_TEMP%' -Force"
    
    if errorlevel 1 (
        echo [ERROR] Failed to extract ZIP file
        pause
        exit /b 1
    )
    
    REM Find the extracted directory
    for /d %%D in ("%RESTORE_TEMP%\*") do (
        set RESTORE_DIR=%%D
        goto :found_dir
    )
    :found_dir
    
    if not defined RESTORE_DIR (
        echo [ERROR] Could not find extracted backup directory
        pause
        exit /b 1
    )
) else (
    set RESTORE_DIR=%BACKUP_PATH%
)

echo.
echo ========================================
echo WARNING: This will replace all data!
echo ========================================
echo.
set /p CONFIRM="Type 'YES' to confirm restore: "

if /i not "%CONFIRM%"=="YES" (
    echo Restore cancelled.
    if "%IS_ZIP%"=="1" (
        rd /s /q "%RESTORE_TEMP%"
    )
    pause
    exit /b 0
)

echo.
echo ========================================
echo Step 1: Stopping API container...
echo ========================================
echo.

REM Stop API to prevent conflicts
docker-compose stop api
if errorlevel 1 (
    echo [WARNING] Could not stop API container
)

echo.
echo ========================================
echo Step 2: Restoring database...
echo ========================================
echo.

REM Check if database backup exists
set DB_BACKUP=%RESTORE_DIR%\database\InvoiceApp.bak
if not exist "%DB_BACKUP%" (
    echo [ERROR] Database backup file not found: %DB_BACKUP%
    if "%IS_ZIP%"=="1" (
        rd /s /q "%RESTORE_TEMP%"
    )
    pause
    exit /b 1
)

echo Copying database backup to container...
docker cp "%DB_BACKUP%" invoiceapp-db:/var/opt/mssql/backup/InvoiceApp.bak

if errorlevel 1 (
    echo [ERROR] Failed to copy database backup to container
    if "%IS_ZIP%"=="1" (
        rd /s /q "%RESTORE_TEMP%"
    )
    pause
    exit /b 1
)

echo Restoring database from backup...
docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123 -Q "RESTORE DATABASE InvoiceApp FROM DISK = '/var/opt/mssql/backup/InvoiceApp.bak' WITH REPLACE, STATS = 10"

if errorlevel 1 (
    echo [ERROR] Failed to restore database
    if "%IS_ZIP%"=="1" (
        rd /s /q "%RESTORE_TEMP%"
    )
    pause
    exit /b 1
)

echo [OK] Database restored successfully
echo.

echo ========================================
echo Step 3: Restoring uploaded files...
echo ========================================
echo.

REM Check if uploads directory exists
set UPLOADS_BACKUP=%RESTORE_DIR%\uploads
if exist "%UPLOADS_BACKUP%" (
    echo Copying uploaded files to Docker volume...
    
    REM Clear existing uploads
    docker run --rm -v invoiceapp_api_uploads:/volume alpine sh -c "rm -rf /volume/* /volume/.* 2>/dev/null || true"
    
    REM Copy backup files to volume
    docker run --rm -v invoiceapp_api_uploads:/dest -v "%CD%\%UPLOADS_BACKUP%:/source" alpine sh -c "cp -r /source/* /dest/ 2>/dev/null || true"
    
    if errorlevel 1 (
        echo [WARNING] Some files may not have been restored
    ) else (
        echo [OK] Uploaded files restored successfully
    )
) else (
    echo [INFO] No uploaded files found in backup
)

echo.

REM Cleanup
if "%IS_ZIP%"=="1" (
    echo Cleaning up temporary files...
    rd /s /q "%RESTORE_TEMP%"
)

echo ========================================
echo Step 4: Starting API container...
echo ========================================
echo.

docker-compose start api
if errorlevel 1 (
    echo [WARNING] Could not start API container. You may need to restart manually.
) else (
    echo [OK] API container started
)

echo.
echo ========================================
echo Restore Complete!
echo ========================================
echo.
echo Data has been restored from backup.
echo Please verify the application is working correctly.
echo.
pause
