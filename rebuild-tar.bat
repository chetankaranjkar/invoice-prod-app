@echo off
echo ====================================
echo Rebuilding Docker Images and Tar File
echo ====================================
echo.
echo This script will:
echo   1. Stop running containers
echo   2. Rebuild API and Frontend images with latest changes
echo   3. Create new invoiceapp-images.tar file
echo.
echo NOTE: This includes the new port configuration (3000/5000)
echo       and domain name support (invoiceapp.local)
echo.
pause

cd /d "%~dp0"

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found
    pause
    exit /b 1
)

REM Step 1: Stop any running containers
echo.
echo ====================================
echo Step 1: Stopping running containers...
echo ====================================
docker-compose down
if errorlevel 1 (
    echo [WARNING] Some containers may not have stopped cleanly
)
echo.

REM Step 2: Remove old tar file if it exists
echo ====================================
echo Step 2: Removing old tar file...
echo ====================================
if exist invoiceapp-images.tar (
    echo Deleting old invoiceapp-images.tar...
    del /f invoiceapp-images.tar
    echo [OK] Old tar file deleted
) else (
    echo [INFO] No old tar file found
)
echo.

REM Step 3: Build images
echo ====================================
echo Step 3: Building Docker images...
echo ====================================
echo Building API and Frontend images (this may take a few minutes)...
docker-compose build --no-cache api frontend
if errorlevel 1 (
    echo [ERROR] Build failed. Please check the error messages above.
    pause
    exit /b 1
)
echo [OK] Images built successfully
echo.

REM Step 4: Save images to tar file
echo ====================================
echo Step 4: Saving images to tar file...
echo ====================================
echo.
echo Choose an option:
echo   A) Save ALL images including SQL Server (~2-3 GB) - For offline installation
echo   B) Save only API and Frontend (~500 MB) - Recommended, SQL Server downloads automatically
echo.
set /p CHOICE="Enter choice (A/B, default=B): "

if /i "%CHOICE%"=="A" (
    echo.
    echo Pulling SQL Server image first...
    docker pull mcr.microsoft.com/mssql/server:2022-latest
    echo.
    echo Saving all images including SQL Server...
    docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
    if errorlevel 1 (
        echo [ERROR] Failed to save images with SQL Server. Trying without SQL Server...
        docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images.tar
        if errorlevel 1 (
            echo [ERROR] Failed to save images
            pause
            exit /b 1
        )
        echo [OK] Saved without SQL Server (will be pulled on client)
    ) else (
        echo [OK] All images saved to invoiceapp-images.tar
    )
) else (
    echo.
    echo Saving API and Frontend images only (recommended)...
    docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images.tar
    if errorlevel 1 (
        echo [ERROR] Failed to save images
        pause
        exit /b 1
    )
    echo [OK] API and Frontend images saved to invoiceapp-images.tar
    echo [INFO] SQL Server will be downloaded automatically on client when docker-compose runs
)
echo.

REM Step 5: Verify tar file
echo ====================================
echo Step 5: Verifying tar file...
echo ====================================
if exist invoiceapp-images.tar (
    for %%F in (invoiceapp-images.tar) do (
        echo File: invoiceapp-images.tar
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1MB, 2)"') do echo Size: %%A MB
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1GB, 2)"') do echo Size: %%A GB ^(approx^)
    )
    echo [OK] Tar file created successfully!
) else (
    echo [ERROR] invoiceapp-images.tar was not created
    pause
    exit /b 1
)
echo.

REM Step 6: Summary
echo ====================================
echo Build Complete!
echo ====================================
echo.
echo Files ready for distribution:
echo   1. invoiceapp-images.tar (Docker images)
echo   2. docker-compose.yml (Updated with new ports: 3000/5000)
echo   3. install-from-pendrive.bat (Installation script)
echo   4. setup-domain.bat (Optional: Domain name setup)
echo.
echo Updated Configuration:
echo   - Frontend: http://localhost:3000 or http://invoiceapp.local:3000
echo   - API:      http://localhost:5000
echo   - Swagger:   http://localhost:5000/swagger
echo.
echo Next steps:
echo   1. Copy invoiceapp-images.tar to pendrive/client
echo   2. Copy docker-compose.yml to client
echo   3. Copy install-from-pendrive.bat to client
echo   4. On client: Run install-from-pendrive.bat
echo   5. Optional: Run setup-domain.bat to use invoiceapp.local
echo.
pause
