# Quick Start Guide

## Important: Run docker-compose from the correct directory!

The `docker-compose.yml` file is located in the `InvoiceApp` directory. You **must** run docker-compose commands from that directory.

## Correct Usage

### Option 1: Change to InvoiceApp directory first (Recommended)

```powershell
# Navigate to InvoiceApp directory
cd InvoiceApp

# Then run docker-compose commands
docker-compose up -d
docker-compose logs -f api
docker-compose down
```

### Option 2: Use the provided scripts

The scripts in the `InvoiceApp` directory already handle the directory change:

```powershell
# From InvoiceApp directory
.\install-from-pendrive.bat
.\start-docker.bat
.\check-status.bat
```

### Option 3: Use the parent directory wrapper script

From the parent directory (`Invoice Master`), use:

```powershell
.\start-invoice-app.bat
```

## Common Error

❌ **Wrong:**
```powershell
PS D:\reactprojects\Invoice Master> docker-compose up -d
# Error: resolve : CreateFile D:\reactprojects\Invoice Master\InvoiceApp.Api: The system cannot find the file specified.
```

✅ **Correct:**
```powershell
PS D:\reactprojects\Invoice Master> cd InvoiceApp
PS D:\reactprojects\Invoice Master\InvoiceApp> docker-compose up -d
# Works correctly!
```

## Directory Structure

```
Invoice Master/
  ├── InvoiceApp/                    ← docker-compose.yml is HERE
  │   ├── docker-compose.yml        ← Run commands from this directory
  │   ├── install-from-pendrive.bat
  │   ├── start-docker.bat
  │   ├── InvoiceApp.Api/
  │   │   └── Dockerfile
  │   ├── InvoiceApp.Application/
  │   ├── InvoiceApp.Infrastructure/
  │   ├── invoice-app/
  │   │   └── Dockerfile
  │   └── ...
  └── start-invoice-app.bat         ← Wrapper script from parent directory
```

## Quick Commands Reference

From `InvoiceApp` directory:

```powershell
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f

# Check status
docker-compose ps

# Stop all services
docker-compose down

# Rebuild and start
docker-compose build api
docker-compose up -d

# Stop and remove everything (including volumes)
docker-compose down -v
```

## Installation Steps

1. **Navigate to InvoiceApp directory:**
   ```powershell
   cd InvoiceApp
   ```

2. **Run installation script:**
   ```powershell
   .\install-from-pendrive.bat
   ```

   OR manually:
   ```powershell
   docker-compose down
   docker-compose build api
   docker-compose up -d
   ```

3. **Wait for services to start** (2-3 minutes on first run)

4. **Verify installation:**
   ```powershell
   docker-compose ps
   docker-compose logs api --tail=50
   ```

5. **Access application:**
   - Frontend: http://localhost
   - API Swagger: http://localhost:5001/swagger

## Troubleshooting

### Error: "CreateFile ... InvoiceApp.Api: The system cannot find the file specified"

**Solution:** You're running docker-compose from the wrong directory. Navigate to the `InvoiceApp` directory first:
```powershell
cd InvoiceApp
docker-compose up -d
```

### Error: "docker-compose.yml not found"

**Solution:** Make sure you're in the `InvoiceApp` directory:
```powershell
# Check current directory
pwd  # or `cd` in PowerShell

# Navigate to InvoiceApp
cd InvoiceApp

# Verify docker-compose.yml exists
dir docker-compose.yml
```

### Scripts don't work

**Solution:** Scripts use `cd /d "%~dp0"` which changes to the script's directory. Make sure:
- Scripts are in the `InvoiceApp` directory
- Run them from the `InvoiceApp` directory
- OR use full path: `D:\reactprojects\Invoice Master\InvoiceApp\install-from-pendrive.bat`
