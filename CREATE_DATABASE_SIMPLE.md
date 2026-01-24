# Quick Fix: Create InvoiceApp Database

## Problem
The `InvoiceApp` database is not created automatically when running `install-from-pendrive.bat` or when starting containers.

## Solution: Create Database Manually in SSMS (Easiest Method)

### Step 1: Connect to SQL Server
1. Open **SQL Server Management Studio (SSMS)**
2. Connect to:
   - **Server name**: `localhost,1434`
   - **Authentication**: SQL Server Authentication
   - **Login**: `sa`
   - **Password**: `YourStrong@Password123`

### Step 2: Create Database
**Option A: Using GUI**
1. Right-click on **"Databases"** in Object Explorer
2. Click **"New Database..."**
3. Enter database name: `InvoiceApp`
4. Click **OK**

**Option B: Using SQL Query**
1. Click **"New Query"** button
2. Paste and run this SQL:
```sql
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'InvoiceApp')
BEGIN
    CREATE DATABASE InvoiceApp;
    PRINT 'Database InvoiceApp created successfully!';
END
ELSE
BEGIN
    PRINT 'Database InvoiceApp already exists.';
END
GO
```

### Step 3: Restart API to Apply Migrations
After creating the database, restart the API container to apply migrations (create tables):

```powershell
docker-compose restart api
```

### Step 4: Watch Logs to Verify
Watch the API logs to see migrations being applied:

```powershell
docker-compose logs -f api
```

You should see:
```
📦 Applying database migrations...
✅ Database migrations applied successfully
✅ Database seeded with initial data
```

### Step 5: Verify Database in SSMS
1. In SSMS, right-click **"Databases"** > **Refresh**
2. Expand **InvoiceApp** database
3. Expand **Tables**
4. You should see tables like:
   - Users
   - Customers
   - Invoices
   - InvoiceItems
   - Payments
   - AuditLogs

### Step 6: Verify Data was Seeded
Run this query in SSMS:
```sql
USE InvoiceApp;
SELECT Email, Name, Role FROM Users;
```

You should see at least one user: `chetan.karanjkar@gmail.com` with role `MasterUser`

## Alternative: Use PowerShell Script

If you prefer automated approach:

```powershell
.\create-database-manually.ps1
```

Then restart API:
```powershell
docker-compose restart api
```

## Why Database Isn't Created Automatically?

The database should be created automatically when the API starts, but it may fail if:
1. **API container starts before SQL Server is fully ready** - Even with retry logic, sometimes it fails
2. **Connection string issues** - Port changes or network problems
3. **API startup fails** - Check logs: `docker-compose logs api`

## Prevention: Ensure Proper Startup Order

The `install-from-pendrive.bat` script now:
1. Starts SQL Server first
2. Waits 90 seconds for it to be ready
3. Builds and starts API (which creates the database)
4. Waits additional time for database creation

If database still doesn't create, use the manual method above.

## Verify Everything is Working

After creating database and restarting API, run:

```powershell
.\verify-database-created.ps1
```

This will check:
- ✅ Database exists
- ✅ Tables are created
- ✅ Data is seeded

## Quick Test

Test the API:
```powershell
curl http://localhost:5001/health
```

Or visit in browser: `http://localhost:5001/health`

You should see: `{"status":"healthy","timestamp":"..."}`
