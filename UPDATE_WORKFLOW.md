# Application Update Workflow

## When to Rebuild

You need to rebuild Docker images and create a new tar file when:

✅ **You change application code:**
- Modify API code (C#, controllers, services, etc.)
- Modify Frontend code (React, TypeScript, components, etc.)
- Change configuration files
- Add new features or fix bugs

❌ **You DON'T need to rebuild for:**
- Just changing documentation files
- Changing files that aren't copied into Docker images
- Only modifying `.gitignore` or documentation

## Update Sequence

### Step 1: Make Your Changes
Make changes to your application code in:
- `InvoiceApp.Api/` (API changes)
- `invoice-app/src/` (Frontend changes)
- `InvoiceApp.Infrastructure/` (Database/Infrastructure changes)
- etc.

### Step 2: Rebuild Images and Create New Tar File
```powershell
# Navigate to InvoiceApp directory
cd "D:\reactprojects\Invoice Master\InvoiceApp"

# Run the build script
.\build-images.bat
```

**This script will:**
1. ✅ Stop any running containers
2. ✅ Rebuild API image with your latest code
3. ✅ Rebuild Frontend image with your latest code
4. ✅ Pull SQL Server image (if needed)
5. ✅ Save images to `invoiceapp-images.tar`

**Time:** Takes 10-15 minutes (full rebuild)

### Step 3: Copy Files to Pendrive/Client

Copy these files to pendrive or client machine:
```
InvoiceApp/
├── invoiceapp-images.tar          ← NEW tar file with updated images (required)
├── docker-compose.yml             ← Updated if you changed Docker config (optional)
└── install-from-pendrive.bat      ← Updated if you changed installation steps (optional)
```

**Note:** Usually only `invoiceapp-images.tar` needs to be updated if you only changed application code.

### Step 4: On Client Machine - Install/Update

**For Fresh Installation:**
```powershell
# Navigate to InvoiceApp directory on client
cd InvoiceApp

# Run installation script
.\install-from-pendrive.bat
```

**For Updating Existing Installation:**
```powershell
# Stop existing containers
docker-compose down

# Load new images from tar
docker load -i invoiceapp-images.tar

# Start with new images
docker-compose up -d
```

Or use the installation script (it handles updates too):
```powershell
.\install-from-pendrive.bat
```

## Quick Reference

### Development Workflow:

```
1. Make changes to code
   ↓
2. Run: .\build-images.bat
   ↓
3. Copy invoiceapp-images.tar to pendrive
   ↓
4. On client: .\install-from-pendrive.bat
```

## What Gets Rebuilt?

### When you run `build-images.bat`:

1. **API Image (`invoiceapp-api:latest`):**
   - Builds from `InvoiceApp.Api/Dockerfile`
   - Includes: All C# code, compiled DLLs, dependencies
   - Includes: Latest changes to API code

2. **Frontend Image (`invoiceapp-frontend:latest`):**
   - Builds from `invoice-app/Dockerfile`
   - Includes: Built React app (npm run build)
   - Includes: Latest changes to frontend code

3. **SQL Server Image:**
   - Uses existing or pulls `mcr.microsoft.com/mssql/server:2022-latest`
   - Usually doesn't change (unless Microsoft updates it)

## Important Notes

### ⚠️ Database Changes:

If you made **database schema changes** (migrations):
- ✅ New migrations are included in the rebuilt API image
- ✅ Migrations run automatically when API starts
- ✅ Database is updated automatically on client

**No manual migration needed!**

### ⚠️ Environment Variables:

If you changed environment variables in `docker-compose.yml`:
- ✅ Copy updated `docker-compose.yml` to client
- ✅ Or just update the environment section on client

### ⚠️ Data Persistence:

When updating on client:
- ✅ Existing data in database is preserved (stored in Docker volumes)
- ✅ Only application code/images are updated
- ✅ Database schema is migrated automatically

## Update Scenarios

### Scenario 1: Code Changes Only

**What changed:** API or Frontend code

**Steps:**
1. Make changes
2. `.\build-images.bat`
3. Copy `invoiceapp-images.tar` to client
4. On client: `docker-compose down && docker load -i invoiceapp-images.tar && docker-compose up -d`

### Scenario 2: Docker Configuration Changes

**What changed:** `docker-compose.yml` (ports, volumes, environment variables)

**Steps:**
1. Update `docker-compose.yml`
2. `.\build-images.bat` (to rebuild images if code changed)
3. Copy both `invoiceapp-images.tar` AND `docker-compose.yml` to client
4. On client: `docker-compose down && docker load -i invoiceapp-images.tar && docker-compose up -d`

### Scenario 3: Only Frontend Changed

**What changed:** Only React/Frontend code

**Steps:**
1. Make changes
2. `docker-compose build --no-cache frontend` (faster - only rebuilds frontend)
3. `docker save invoiceapp-frontend:latest -o frontend-only.tar`
4. Or run full `.\build-images.bat` (includes everything)

### Scenario 4: Only API Changed

**What changed:** Only C#/API code

**Steps:**
1. Make changes
2. `docker-compose build --no-cache api` (faster - only rebuilds API)
3. `docker save invoiceapp-api:latest -o api-only.tar`
4. Or run full `.\build-images.bat` (includes everything)

## Best Practices

### ✅ Do This:

1. **Test changes locally first:**
   ```powershell
   docker-compose build api
   docker-compose up -d
   # Test your changes
   ```

2. **Rebuild with `--no-cache` for clean builds:**
   ```powershell
   .\build-images.bat  # Already uses --no-cache
   ```

3. **Version your tar files:**
   ```powershell
   docker save invoiceapp-api:latest invoiceapp-frontend:latest -o invoiceapp-images-v1.1.tar
   ```

4. **Document changes:**
   - Keep notes of what changed in each version
   - Helps track which version client has

### ❌ Don't Do This:

1. **Don't rebuild on client machine** (unless distributing source code)
2. **Don't skip testing** before creating tar file
3. **Don't forget to include** updated `docker-compose.yml` if you changed it
4. **Don't copy old tar files** - always use the latest

## Quick Update Script (for client)

Create `update-app.bat` for easy updates on client:

```batch
@echo off
echo Updating Invoice App...
docker-compose down
docker load -i invoiceapp-images.tar
docker-compose up -d
echo Update complete!
```

## Summary

**Yes, your understanding is correct!**

```
1. Make changes to application
   ↓
2. Run: .\build-images.bat
   (Creates new invoiceapp-images.tar with your changes)
   ↓
3. Copy invoiceapp-images.tar to pendrive/client
   ↓
4. On client: .\install-from-pendrive.bat
   (Loads images and starts application)
```

**Important:** Always rebuild after code changes to include them in the Docker images!
