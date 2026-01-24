# Docker Setup - README

## ⚠️ IMPORTANT: Directory Structure

The `docker-compose.yml` file is located in the **`InvoiceApp`** directory. You **MUST** run docker-compose commands from that directory.

## Directory Structure

```
D:\reactprojects\Invoice Master\
  └── InvoiceApp\                    ← docker-compose.yml is HERE
      ├── docker-compose.yml        ← Run docker-compose from this directory
      ├── install-from-pendrive.bat ← Run from InvoiceApp directory
      ├── start-docker.bat          ← Run from InvoiceApp directory
      ├── InvoiceApp.Api\
      │   └── Dockerfile
      ├── InvoiceApp.Application\
      ├── InvoiceApp.Infrastructure\
      ├── invoice-app\
      │   └── Dockerfile
      └── ...
```

## ✅ Correct Usage

### Option 1: Navigate to InvoiceApp directory first (Recommended)

```powershell
# Navigate to InvoiceApp directory
cd "D:\reactprojects\Invoice Master\InvoiceApp"

# Then run docker-compose commands
docker-compose up -d
docker-compose logs -f api
docker-compose down
```

### Option 2: Use the provided scripts (from InvoiceApp directory)

```powershell
# Make sure you're in InvoiceApp directory
cd "D:\reactprojects\Invoice Master\InvoiceApp"

# Run installation
.\install-from-pendrive.bat

# OR quick start
.\start-docker.bat
```

### Option 3: Use scripts with full path

```powershell
# From any directory
"D:\reactprojects\Invoice Master\InvoiceApp\install-from-pendrive.bat"
```

## ❌ Common Error

If you see this error:
```
resolve : CreateFile D:\reactprojects\Invoice Master\InvoiceApp.Api: The system cannot find the file specified.
```

**Cause:** You're running `docker-compose` from the wrong directory (parent directory instead of `InvoiceApp`).

**Solution:**
```powershell
# Navigate to InvoiceApp directory first
cd InvoiceApp

# Then run docker-compose
docker-compose up -d
```

## Quick Start Commands

From the `InvoiceApp` directory:

```powershell
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Check status
docker-compose ps

# Stop services
docker-compose down

# Rebuild and start
docker-compose build api
docker-compose up -d

# Complete reset (removes volumes)
docker-compose down -v
```

## Installation Steps

1. **Open PowerShell/Terminal**

2. **Navigate to InvoiceApp directory:**
   ```powershell
   cd "D:\reactprojects\Invoice Master\InvoiceApp"
   ```

3. **Verify docker-compose.yml exists:**
   ```powershell
   dir docker-compose.yml
   ```

4. **Run installation script:**
   ```powershell
   .\install-from-pendrive.bat
   ```

   OR manually:
   ```powershell
   docker-compose down
   docker-compose build api
   docker-compose up -d
   ```

5. **Wait for services to start** (2-3 minutes on first run)

6. **Check status:**
   ```powershell
   docker-compose ps
   ```

7. **View logs:**
   ```powershell
   docker-compose logs api --tail=50
   ```

8. **Access application:**
   - Frontend: http://localhost
   - API: http://localhost:5001
   - API Swagger: http://localhost:5001/swagger

## Troubleshooting

### Error: "docker-compose.yml not found"

**Solution:** You're not in the correct directory. Navigate to `InvoiceApp`:
```powershell
cd InvoiceApp
```

### Error: "CreateFile ... InvoiceApp.Api: The system cannot find the file specified"

**Solution:** Run docker-compose from `InvoiceApp` directory:
```powershell
cd InvoiceApp
docker-compose up -d
```

### Scripts don't work

**Solution:** The scripts use `cd /d "%~dp0"` which changes to the script's directory. Make sure:
- Scripts are in the `InvoiceApp` directory
- OR use full path to run them

## Verification

After installation, verify everything works:

```powershell
# Check container status
docker-compose ps

# Check health endpoint
curl http://localhost:5001/api/Health

# Check API logs
docker-compose logs api --tail=100
```

You should see:
- All containers in "Up" status
- Health endpoint returns: `{"status":"Healthy","database":"✅ Database healthy...",...}`
- API logs show database creation messages

## Access URLs

- **Frontend:** http://localhost
- **API:** http://localhost:5001
- **API Swagger:** http://localhost:5001/swagger
- **SQL Server (SSMS):** localhost,1434

## Default Credentials

- **Email:** chetan.karanjkar@gmail.com
- **Password:** Medrio@1234

## SQL Server Credentials

- **Server:** localhost,1434
- **Login:** sa
- **Password:** YourStrong@Password123
