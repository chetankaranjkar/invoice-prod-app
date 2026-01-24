# How to Create the InvoiceApp Database

## Problem
The `InvoiceApp` database is not visible in SSMS even though you can connect to SQL Server.

## Root Cause
The database is created automatically when the API container starts and runs migrations. If the database doesn't exist, it means:
1. The API container hasn't started yet, or
2. The API container failed during startup/migration, or
3. The containers need to be rebuilt with the latest code changes

## Solution 1: Check Status and Restart (Recommended)

### Step 1: Check if API container is running
```powershell
docker-compose ps api
```

### Step 2: Check API logs for database creation
```powershell
docker-compose logs api --tail=100
```

Look for messages like:
- ✅ `Database connection successful!`
- ✅ `Database migrations applied successfully`
- ✅ `Database seeded with initial data`
- ❌ `Failed to connect to database` (error)

### Step 3: If API failed, rebuild and restart
```powershell
# Stop everything
docker-compose down

# Rebuild API (to include retry logic and latest changes)
docker-compose build api

# Start everything
docker-compose up -d

# Watch the logs to see database creation
docker-compose logs -f api
```

Wait for messages showing database creation (can take 2-3 minutes on first startup).

## Solution 2: Manually Create Database and Restart API

If the API container is running but database wasn't created, you can create it manually:

### Step 1: Create the database manually using SQL
In SSMS (connected to `localhost,1434`), run:
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
```

OR use the PowerShell script:
```powershell
.\create-database-manually.ps1
```

### Step 2: Restart the API container to apply migrations
```powershell
docker-compose restart api
```

### Step 3: Watch the logs to verify migrations are applied
```powershell
docker-compose logs -f api
```

You should see:
- `📦 Applying database migrations...`
- `✅ Database migrations applied successfully`

## Solution 3: Check Current Status

Run the diagnostic script:
```powershell
.\check-database-status.ps1
```

This will show:
- Container status
- API logs (database-related messages)
- Whether InvoiceApp database exists
- All databases in SQL Server

## Verification Steps

### 1. Verify database exists in SSMS
1. Connect to `localhost,1434` in SSMS
2. Expand "Databases" in Object Explorer
3. You should see `InvoiceApp` database

### 2. Verify database has tables
In SSMS, expand `InvoiceApp` > `Tables` and you should see tables like:
- Users
- Customers
- Invoices
- InvoiceItems
- Payments
- AuditLogs

### 3. Verify data was seeded
Run this query in SSMS:
```sql
USE InvoiceApp;
SELECT Email, Name, Role FROM Users;
```

You should see at least one user: `chetan.karanjkar@gmail.com` with role `MasterUser`

### 4. Check API health endpoint
```powershell
curl http://localhost:5001/health
```

Or visit in browser: `http://localhost:5001/health`

## Common Issues

### Issue: "Container is not running"
**Solution**: Start containers
```powershell
docker-compose up -d
```

### Issue: "API logs show connection errors"
**Solution**: Wait 60-90 seconds for SQL Server to be ready, then restart API
```powershell
docker-compose restart api
docker-compose logs -f api
```

### Issue: "Database exists but no tables"
**Solution**: Restart API to apply migrations
```powershell
docker-compose restart api
```

### Issue: "Can't see database in SSMS"
**Solution**: Refresh the Databases folder in SSMS (right-click > Refresh), or reconnect to the server

## Quick Fix Script

Run this complete fix script:
```powershell
# Stop everything
docker-compose down

# Remove old volumes (CAUTION: This deletes all data!)
# docker volume rm invoiceapp_sqlserver_data

# Rebuild API
docker-compose build api

# Start everything
docker-compose up -d

# Wait 60 seconds for SQL Server
Start-Sleep -Seconds 60

# Check API logs
docker-compose logs api --tail=50

# Verify database exists
docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT name FROM sys.databases WHERE name = 'InvoiceApp'" -h -1 -W
```

## Expected Timeline

- **SQL Server startup**: 60-90 seconds
- **API startup + database creation**: 30-60 seconds
- **Total first startup**: 2-3 minutes

## Next Steps

Once the database is created and you see it in SSMS:
1. ✅ Database should appear in Object Explorer
2. ✅ Tables should be created under `InvoiceApp` > `Tables`
3. ✅ At least one user should exist (for login)
4. ✅ API should respond at `http://localhost:5001/health`
5. ✅ You can login to the application at `http://localhost`
