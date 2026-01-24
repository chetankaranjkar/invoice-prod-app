@echo off
echo ====================================
echo Building Docker Images for Invoice App
echo ====================================
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

echo Step 1: Stopping any running containers...
docker-compose down
echo.

echo Step 2: Building Docker images (this may take 10-15 minutes)...
echo.
echo Building API image...
docker-compose build --no-cache api
if errorlevel 1 (
    echo [ERROR] Failed to build API image
    pause
    exit /b 1
)
echo [OK] API image built successfully
echo.

echo Building Frontend image...
docker-compose build --no-cache frontend
if errorlevel 1 (
    echo [ERROR] Failed to build Frontend image
    pause
    exit /b 1
)
echo [OK] Frontend image built successfully
echo.

echo Step 3: Pulling SQL Server image (if not already present)...
docker pull mcr.microsoft.com/mssql/server:2022-latest
if errorlevel 1 (
    echo [WARNING] Failed to pull SQL Server image
    echo Will save only API and Frontend images
    echo SQL Server will be downloaded automatically on client machine
    goto :SaveWithoutSQL
)
echo [OK] SQL Server image is ready
echo.

echo Step 4: Saving all images to tar file (including SQL Server)...
echo This may take a few minutes (file will be ~2-3 GB)...
docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
if errorlevel 1 (
    echo [ERROR] Failed to save with SQL Server image
    echo Trying without SQL Server image...
    goto :SaveWithoutSQL
)
echo [OK] All images saved to invoiceapp-images.tar
goto :AfterSave

:SaveWithoutSQL
echo.
echo Saving API and Frontend images only...
echo Note: SQL Server will be downloaded automatically on client (saves ~1.5 GB)...
docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images.tar
if errorlevel 1 (
    echo [ERROR] Failed to save images
    pause
    exit /b 1
)
echo [OK] API and Frontend images saved to invoiceapp-images.tar
echo [INFO] SQL Server image will be downloaded automatically on client machine

:AfterSave
echo.

echo Step 5: Checking file size...
if exist invoiceapp-images.tar (
    for %%F in (invoiceapp-images.tar) do (
        set size=%%~zF
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1GB, 2)"') do set sizeGB=%%A
        echo File size: %%~zF bytes ^(approx !sizeGB! GB^)
    )
) else (
    echo [ERROR] invoiceapp-images.tar was not created
    pause
    exit /b 1
)
echo.

echo ====================================
echo Build Complete!
echo ====================================
echo.
echo Images saved to: invoiceapp-images.tar
echo File location: %CD%\invoiceapp-images.tar
echo.
echo Next steps:
echo 1. Copy invoiceapp-images.tar to pendrive/client machine
echo 2. Copy these files to client:
echo    - docker-compose.yml
echo    - install-from-pendrive.bat
echo    - invoiceapp-images.tar
echo 3. On client machine, navigate to InvoiceApp directory
echo 4. Run: install-from-pendrive.bat
echo.
pause
