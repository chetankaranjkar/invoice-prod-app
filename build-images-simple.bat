@echo off
echo ====================================
echo Building Docker Images for Invoice App
echo ====================================
echo.

cd /d "%~dp0"

if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found
    pause
    exit /b 1
)

echo Step 1: Stopping any running containers...
docker-compose down
echo.

echo Step 2: Building API and Frontend images...
docker-compose build --no-cache api frontend
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Images built successfully
echo.

echo Step 3: Pulling SQL Server image (if needed)...
docker pull mcr.microsoft.com/mssql/server:2022-latest
echo.

echo Step 4: Saving images to tar file...
echo Option A: Save ALL images including SQL Server (~2-3 GB)
echo Option B: Save only API and Frontend, SQL Server will be pulled on client (~500 MB)
echo.
set /p CHOICE="Choose option (A/B, default=A): "

if /i "%CHOICE%"=="B" (
    echo Saving API and Frontend images only (recommended for smaller file size)...
    docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images.tar
    if errorlevel 1 (
        echo [ERROR] Failed to save images
        pause
        exit /b 1
    )
    echo [OK] API and Frontend images saved to invoiceapp-images.tar
    echo [INFO] SQL Server will be downloaded automatically on client (docker-compose will pull it)
) else (
    echo Saving all images including SQL Server...
    docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
    if errorlevel 1 (
        echo [ERROR] Failed to save images. Trying without SQL Server...
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
)
echo.

echo Step 5: File information...
if exist invoiceapp-images.tar (
    for %%F in (invoiceapp-images.tar) do (
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1MB, 2)"') do echo File size: %%A MB
        for /f "tokens=*" %%A in ('powershell -command "[math]::Round(%%~zF / 1GB, 2)"') do echo File size: %%A GB ^(approx^)
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
echo Files to copy to client/pendrive:
echo   1. invoiceapp-images.tar
echo   2. docker-compose.yml
echo   3. install-from-pendrive.bat
echo.
echo On client machine:
echo   1. Copy files to InvoiceApp directory
echo   2. Run: install-from-pendrive.bat
echo.
pause
