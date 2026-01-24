# Building and Saving Docker Images - Complete Guide

## Overview
This guide explains how to build Docker images and save them to a tar file for distribution to client machines.

## Prerequisites
- Docker Desktop installed and running
- Navigate to `InvoiceApp` directory

## Step-by-Step Sequence

### Step 1: Navigate to Correct Directory

```powershell
cd "D:\reactprojects\Invoice Master\InvoiceApp"
```

Verify `docker-compose.yml` exists:
```powershell
dir docker-compose.yml
```

### Step 2: Stop Any Running Containers

```powershell
docker-compose down
```

This ensures clean builds.

### Step 3: Build Docker Images

Build all images using docker-compose:

```powershell
docker-compose build --no-cache
```

Or build individually:

```powershell
# Build API image
docker-compose build --no-cache api

# Build Frontend image
docker-compose build --no-cache frontend

# SQL Server image is pulled from Microsoft, no need to build
```

**What this does:**
- `--no-cache` - Forces rebuild from scratch (ensures latest code)
- Builds all services defined in `docker-compose.yml`
- API: Builds from `InvoiceApp.Api/Dockerfile`
- Frontend: Builds from `invoice-app/Dockerfile`
- SQL Server: Uses pre-built image from Microsoft

### Step 4: Tag Images (Optional but Recommended)

```powershell
# Tag images with version or date
docker tag invoiceapp-api:latest invoiceapp-api:v1.0
docker tag invoiceapp-frontend:latest invoiceapp-frontend:v1.0
```

### Step 5: Save Images to Tar File

Save all images to a single tar file:

```powershell
# Save all invoiceapp images
docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
```

**Or save to separate files:**

```powershell
# Save API image
docker save invoiceapp-api:latest -o invoiceapp-api.tar

# Save Frontend image
docker save invoiceapp-frontend:latest -o invoiceapp-frontend.tar

# SQL Server image (optional - can be pulled from internet)
docker save mcr.microsoft.com/mssql/server:2022-latest -o sqlserver.tar
```

### Step 6: Verify Tar File Created

```powershell
dir *.tar
```

You should see:
- `invoiceapp-images.tar` (or individual tar files)
- File size should be several GB (images are large)

### Step 7: Copy Files to Pendrive/Client Machine

Copy these files to pendrive or client machine:

**Required Files:**
```
InvoiceApp/
├── invoiceapp-images.tar              ← Docker images (required)
├── docker-compose.yml                 ← Docker configuration (required)
├── install-from-pendrive.bat          ← Installation script (required)
├── InvoiceApp.Api/                    ← Source code (if building on client)
├── InvoiceApp.Application/            ← Source code (if building on client)
├── InvoiceApp.Infrastructure/         ← Source code (if building on client)
├── InvoiceApp.Domain/                 ← Source code (if building on client)
├── invoice-app/                       ← Frontend source (if building on client)
└── InvoiceApp.sln                     ← Solution file (if building on client)
```

**OR Minimal Files for Distribution:**
```
InvoiceApp/
├── invoiceapp-images.tar              ← All Docker images (required)
├── docker-compose.yml                 ← Docker configuration (required)
├── install-from-pendrive.bat          ← Installation script (required)
└── start-docker.bat                   ← Quick start script (optional)
```

### Step 8: On Client Machine - Load Images

On the client machine:

```powershell
# Navigate to InvoiceApp directory
cd InvoiceApp

# Load images from tar file
docker load -i invoiceapp-images.tar

# Verify images loaded
docker images | findstr invoiceapp
```

**Or use the installation script:**
```powershell
.\install-from-pendrive.bat
```

This script automatically:
1. Loads images from `invoiceapp-images.tar`
2. Starts SQL Server
3. Starts API (creates database automatically)
4. Starts Frontend
5. Verifies installation

## Complete Build Script

Create a `build-images.bat` script for convenience:

```batch
@echo off
echo ====================================
echo Building Docker Images for Invoice App
echo ====================================
echo.

cd /d "%~dp0"

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

echo Step 3: Saving images to tar file...
docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
if errorlevel 1 (
    echo [ERROR] Failed to save images
    pause
    exit /b 1
)
echo [OK] Images saved to invoiceapp-images.tar
echo.

echo Step 4: Checking file size...
for %%F in (invoiceapp-images.tar) do echo File size: %%~zF bytes (%%~zF / 1024 / 1024 / 1024 GB)
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
echo 2. Copy docker-compose.yml and install-from-pendrive.bat
echo 3. On client machine, run: install-from-pendrive.bat
echo.
pause
```

## Quick Commands Reference

### Build All Images
```powershell
docker-compose build --no-cache
```

### Build Individual Images
```powershell
docker-compose build --no-cache api
docker-compose build --no-cache frontend
```

### Save Images to Tar
```powershell
docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar
```

### Load Images from Tar (on client)
```powershell
docker load -i invoiceapp-images.tar
```

### Verify Images
```powershell
docker images | findstr invoiceapp
```

### Check Image Size
```powershell
docker images
```

## Expected Image Sizes

- **invoiceapp-api**: ~200-300 MB
- **invoiceapp-frontend**: ~50-100 MB  
- **sqlserver (mssql/server:2022-latest)**: ~1.5-2 GB
- **Total tar file**: ~2-3 GB (compressed)

## Troubleshooting

### Error: "docker-compose.yml not found"
**Solution:** Make sure you're in the `InvoiceApp` directory

### Error: "Build failed"
**Solution:** 
- Check Docker Desktop is running
- Check disk space (need at least 10GB free)
- Check network connection (for pulling base images)
- Try building one service at a time

### Error: "Out of disk space"
**Solution:**
- Clean up old images: `docker system prune -a`
- Remove unused volumes: `docker volume prune`

### Tar file too large
**Solution:**
- Compress the tar file: Use 7-Zip or WinRAR
- Or save without SQL Server image (download on client): 
  ```powershell
  docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images.tar
  ```

## Complete Workflow Summary

**On Your Development Machine:**
1. `cd InvoiceApp`
2. `docker-compose build --no-cache`
3. `docker save invoiceapp-api:latest invoiceapp-frontend:latest mcr.microsoft.com/mssql/server:2022-latest -o invoiceapp-images.tar`
4. Copy `invoiceapp-images.tar`, `docker-compose.yml`, and `install-from-pendrive.bat` to pendrive

**On Client Machine:**
1. Copy files from pendrive to `InvoiceApp` directory
2. Run `install-from-pendrive.bat`
3. Wait 2-3 minutes for installation
4. Access application at http://localhost

## Alternative: Build on Client Machine

If tar file is too large, you can distribute source code and build on client:

1. Copy entire `InvoiceApp` directory to client
2. On client machine: `docker-compose build`
3. Then: `docker-compose up -d`

But this requires:
- Docker Desktop on client
- Node.js installed (for frontend build)
- .NET SDK (for API build) - OR use pre-built images

## Best Practice

**Recommended approach:**
1. Build images on your machine
2. Save to tar file
3. Copy tar file + `docker-compose.yml` + `install-from-pendrive.bat` to pendrive
4. On client: Load images and run installation script

This ensures:
- ✅ Consistent builds
- ✅ Faster deployment on client
- ✅ No need for build tools on client machine
- ✅ Automatic database creation on first run
