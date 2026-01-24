@echo off
REM Script to install Invoice App from pendrive/tar file
REM This script loads Docker images and starts the application

echo ========================================
echo Invoice App - Docker Installation
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [OK] Docker is installed
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in current directory
    echo Please run this script from the InvoiceApp directory
    pause
    exit /b 1
)

REM Check if tar file exists
set TAR_FILE=invoiceapp-images.tar
if exist "%TAR_FILE%" (
    echo Loading Docker images from %TAR_FILE%...
    docker load -i "%TAR_FILE%"
    if errorlevel 1 (
        echo [ERROR] Failed to load Docker images from %TAR_FILE%
        echo Continuing anyway...
    ) else (
        echo [OK] Docker images loaded successfully
    )
    echo.
) else (
    echo [INFO] %TAR_FILE% not found, skipping image load
    echo Images will be built from source if needed
    echo.
)

REM Stop any existing containers
echo Stopping any existing containers...
docker-compose down
echo.

REM Start SQL Server first
echo Starting SQL Server...
docker-compose up -d sqlserver
if errorlevel 1 (
    echo [ERROR] Failed to start SQL Server container
    pause
    exit /b 1
)

echo Waiting for SQL Server to be ready (this may take 60-90 seconds)...
echo This may take a while on first startup...
timeout /t 90 /nobreak >nul

REM Check SQL Server health
echo Checking SQL Server health...
docker-compose ps sqlserver | findstr /C:"healthy" >nul
if errorlevel 1 (
    echo [WARNING] SQL Server may not be fully ready yet
    echo Waiting additional 30 seconds...
    timeout /t 30 /nobreak >nul
)

REM Fix backup directory permissions
echo.
echo Fixing backup directory permissions...
docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup" 2>nul
if errorlevel 1 (
    echo [WARNING] Could not fix backup permissions automatically
    echo You may need to run fix-backup-permissions.bat manually
) else (
    echo [OK] Backup directory permissions configured
)

REM Build and start API (this will create the database)
echo.
echo Building and starting API (this will create the InvoiceApp database)...
docker-compose build api
if errorlevel 1 (
    echo [ERROR] Failed to build API container
    pause
    exit /b 1
)

docker-compose up -d api
if errorlevel 1 (
    echo [ERROR] Failed to start API container
    pause
    exit /b 1
)

echo.
echo Waiting for API to initialize and create database (this may take 2-3 minutes)...
timeout /t 180 /nobreak >nul

REM Start Frontend
echo.
echo Starting Frontend...
docker-compose up -d frontend
if errorlevel 1 (
    echo [ERROR] Failed to start Frontend container
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Waiting 10 seconds for services to stabilize...
timeout /t 10 /nobreak >nul

REM Check container status
echo.
echo Checking container status...
docker-compose ps

echo.
echo ========================================
echo Application Access URLs:
echo ========================================
echo - Frontend: http://localhost:3000
echo - Frontend (Domain): http://invoiceapp.local:3000 (if domain is set up)
echo - API: http://localhost:5000
echo - API Swagger: http://localhost:5000/swagger
echo - SQL Server (SSMS): localhost,1434
echo.
echo Default Login Credentials:
echo - Email: chetan.karanjkar@gmail.com
echo - Password: Medrio@1234
echo.
echo SQL Server Credentials:
echo - Server: localhost,1434
echo - Login: sa
echo - Password: YourStrong@Password123
echo.

REM Verify database creation
echo.
echo Verifying InvoiceApp database was created...
echo Checking API logs for database creation...
docker-compose logs api --tail=100 | findstr /C:"Database" /C:"migration" /C:"InvoiceApp" /C:"connection" /C:"created" /C:"ready" /C:"healthy"

REM Check if database was created successfully
docker-compose logs api | findstr /C:"InvoiceApp database" /C:"Database migrations applied" /C:"Database healthy" >nul
if errorlevel 1 (
    echo.
    echo [WARNING] Database creation may still be in progress or failed
    echo Waiting additional 60 seconds...
    timeout /t 60 /nobreak >nul
    
    REM Check again
    docker-compose logs api | findstr /C:"InvoiceApp database" /C:"Database migrations applied" /C:"Database healthy" >nul
    if errorlevel 1 (
        echo [ERROR] Database creation appears to have failed
        echo.
        echo Please check API logs: docker-compose logs api --tail=200
        echo.
        echo The API should automatically create the database on startup.
        echo If it didn't, the installation may have issues.
    ) else (
        echo [OK] Database creation confirmed in logs
    )
) else (
    echo [OK] Database creation confirmed in logs
)

echo.
echo To check logs:
echo - API logs: docker-compose logs -f api
echo - All logs: docker-compose logs -f
echo.
echo To stop the application:
echo - docker-compose down
echo.
pause
