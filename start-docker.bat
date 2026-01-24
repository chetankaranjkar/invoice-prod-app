@echo off
echo ====================================
echo Invoice Master - Docker Quick Start
echo ====================================
echo.

REM Change to script directory (where docker-compose.yml is located)
cd /d "%~dp0"

REM Verify docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in current directory
    echo Please make sure this script is in the InvoiceApp directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not installed or not in PATH
    pause
    exit /b 1
)

echo Docker is installed and ready!
echo.

REM Check if containers are already running
docker-compose ps | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo Containers are already running. Stopping them first...
    docker-compose down
    echo.
)

echo Starting Invoice Master application...
echo This may take 2-3 minutes on first run...
echo.

REM Start services
docker-compose up -d

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start containers
    echo Please check the logs: docker-compose logs
    pause
    exit /b 1
)

echo.
echo ====================================
echo Application is starting up...
echo ====================================
echo.
echo Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

echo.
echo ====================================
echo Invoice Master is ready!
echo ====================================
echo.
echo Access the application at:
echo   Frontend: http://localhost
echo   API Swagger: http://localhost:5001/swagger
echo.
echo Default login credentials:
echo   Master User:
echo     Email: chetan.karanjkar@gmail.com
echo     Password: Medrio@1234
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
pause
