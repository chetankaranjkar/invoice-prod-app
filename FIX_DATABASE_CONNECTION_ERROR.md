# Fix: Database Connection Failed Error

## Problem
The health endpoint returns:
```json
{
  "status": "Healthy",
  "database": "❌ Database connection failed",
  "timestamp": "..."
}
```

## Root Causes

This error occurs when the API cannot connect to SQL Server. Common causes:

1. **Database `InvoiceApp` doesn't exist yet** (Most Common)
2. SQL Server container is not fully ready
3. SQL Server container is not running
4. Network connectivity issue between containers
5. Connection string format issue

## Quick Fix Steps

### Step 1: Run Diagnostic Script

```powershell
.\check-api-db-connection.ps1
```

This will check:
- Container status
- SQL Server health
- API logs for errors
- Connection string
- Network connectivity
- Database existence

### Step 2: Check Container Status

```powershell
docker-compose ps
```

Make sure:
- `invoiceapp-db` status is `running` and health is `healthy`
- `invoiceapp-api` status is `running`

If SQL Server is not healthy:
```powershell
# Wait for SQL Server to be ready (can take 60-90 seconds)
docker-compose logs sqlserver --tail=50

# Restart SQL Server if needed
docker-compose restart sqlserver
```

### Step 3: Check if Database Exists

The most common issue is that the `InvoiceApp` database doesn't exist yet.

**Check in SSMS:**
1. Connect to `localhost,1434`
2. Expand "Databases" in Object Explorer
3. Look for `InvoiceApp` database

**Or check via PowerShell:**
```powershell
.\verify-database-created.ps1
```

### Step 4: Create Database (if it doesn't exist)

**Option A: Using SSMS (Recommended)**
1. Connect to `localhost,1434` in SSMS
2. Right-click "Databases" → "New Database..."
3. Name: `InvoiceApp`
4. Click OK

**Option B: Using PowerShell Script**
```powershell
.\create-database-manually.ps1
```

**Option C: Using SQL Command in SSMS**
```sql
CREATE DATABASE InvoiceApp;
GO
```

### Step 5: Restart API to Apply Migrations

After creating the database, restart the API to apply migrations (create tables):

```powershell
docker-compose restart api
```

### Step 6: Watch Logs to Verify

```powershell
docker-compose logs -f api
```

You should see:
```
✅ Database connection successful!
📦 Applying database migrations...
✅ Database migrations applied successfully
✅ Database seeded with initial data
```

### Step 7: Verify Health Endpoint

```powershell
curl http://localhost:5001/api/Health
```

Should now return:
```json
{
  "status": "Healthy",
  "database": "✅ Database healthy - Users: 1, Invoices: 0",
  "timestamp": "..."
}
```

## Complete Reset (If Nothing Works)

If the above steps don't work, try a complete reset:

```powershell
# Stop everything
docker-compose down

# Remove volumes (WARNING: This deletes all data!)
# docker volume rm invoiceapp_sqlserver_data

# Rebuild and restart
docker-compose build api
docker-compose up -d

# Wait 2-3 minutes for everything to start
Start-Sleep -Seconds 180

# Check status
docker-compose ps

# Check logs
docker-compose logs api --tail=100

# Create database if it still doesn't exist
.\create-database-manually.ps1
docker-compose restart api
```

## Connection String Format

The connection string in `docker-compose.yml` should be:
```
Server=sqlserver,1433;Database=InvoiceApp;User Id=sa;Password=YourStrong@Password123;TrustServerCertificate=true;MultipleActiveResultSets=true;Connect Timeout=60;Command Timeout=60;Pooling=true
```

**Important notes:**
- `Server=sqlserver` - Uses Docker service name (internal networking)
- `,1433` - Internal port (not 1434)
- `Database=InvoiceApp` - Database must exist for the connection to succeed
- `TrustServerCertificate=true` - Required for Docker SQL Server

## Troubleshooting Specific Issues

### Issue: "Server was not found or was not accessible"

**Cause:** SQL Server container is not running or not accessible

**Fix:**
```powershell
# Check if SQL Server is running
docker ps | Select-String invoiceapp-db

# If not running, start it
docker-compose up -d sqlserver

# Wait 60-90 seconds
Start-Sleep -Seconds 90

# Check health
docker inspect invoiceapp-db --format='{{.State.Health.Status}}'
```

### Issue: "Cannot open database 'InvoiceApp' requested by the login"

**Cause:** Database doesn't exist

**Fix:**
1. Create database using SSMS or `create-database-manually.ps1`
2. Restart API: `docker-compose restart api`

### Issue: "Login failed for user 'sa'"

**Cause:** Wrong password or SQL Server not ready

**Fix:**
- Verify password in `docker-compose.yml`: `YourStrong@Password123`
- Make sure SQL Server is fully started (wait 60-90 seconds after container start)

### Issue: Network connectivity failed

**Cause:** Containers are not on the same network

**Fix:**
```powershell
# Verify network exists
docker network ls | Select-String invoiceapp

# Recreate containers on same network
docker-compose down
docker-compose up -d
```

## Expected Timeline

- **SQL Server startup**: 60-90 seconds
- **Database creation**: Automatic when API starts (if API has retry logic)
- **Migrations**: 30-60 seconds
- **Total**: 2-3 minutes on first startup

## Prevention

To ensure database is created automatically in future:

1. Make sure API startup retry logic is working (already implemented)
2. Wait for SQL Server to be `healthy` before starting API (already configured)
3. If automatic creation fails, use manual creation method

## Verification Checklist

After fixing, verify:
- [ ] SQL Server container is `healthy`
- [ ] API container is `running`
- [ ] `InvoiceApp` database exists in SSMS
- [ ] Health endpoint returns healthy status
- [ ] Can login to application
- [ ] Tables exist in database

## Still Having Issues?

Run comprehensive diagnostics:
```powershell
.\check-api-db-connection.ps1
.\verify-database-created.ps1
```

Check detailed logs:
```powershell
docker-compose logs api --tail=200
docker-compose logs sqlserver --tail=100
```
