# Fix for SQL Server Connection Error

## Problem
The API is unable to connect to SQL Server, showing the error:
```
A network-related or instance-specific error occurred while establishing a connection to SQL Server.
The server was not found or was not accessible.
```

## Changes Made

1. **Added Retry Logic in API Startup** (`InvoiceApp.Api/Program.cs`)
   - Waits up to 90 seconds (30 attempts × 3 seconds) for SQL Server to be ready
   - Provides clear console output showing connection attempts

2. **Enhanced Connection String** (`docker-compose.yml`)
   - Added `Connect Timeout=60` and `Command Timeout=60` 
   - Added `Pooling=true` for better connection management

3. **Improved EF Core Retry Configuration** (`InvoiceApp.Infrastructure/DependencyInjection.cs`)
   - Enhanced retry settings: 5 retries with max 30-second delay

4. **Changed Dependency** (`docker-compose.yml`)
   - API now waits for SQL Server to be `service_healthy` before starting
   - Combined with retry logic for maximum reliability

## Solution Steps

### Step 1: Stop all containers
```powershell
docker-compose down
```

### Step 2: Rebuild the API container (to include the new retry logic)
```powershell
docker-compose build api
```

### Step 3: Start all containers
```powershell
docker-compose up -d
```

### Step 4: Monitor the logs
Watch the API container logs to see the connection retry attempts:
```powershell
docker-compose logs -f api
```

You should see messages like:
```
🔍 Waiting for SQL Server to be ready...
   Attempt 1/30: Checking database connection...
   ⏳ SQL Server not ready yet, waiting 3 seconds...
   Attempt 2/30: Checking database connection...
✅ Database connection successful!
📦 Applying database migrations...
✅ Database migrations applied successfully
```

### Step 5: Verify SQL Server is healthy
```powershell
docker-compose ps sqlserver
```
The status should show `healthy` (not just `running`).

### Step 6: Test the login endpoint
```powershell
curl -X POST http://localhost:5001/api/Auth/login `
  -H "Content-Type: application/json" `
  -d '{"email": "chetan.karanjkar@gmail.com", "password": "Medrio@1234"}'
```

## Troubleshooting

If you still get connection errors:

### Check SQL Server logs
```powershell
docker-compose logs sqlserver --tail=50
```

### Check API logs for connection attempts
```powershell
docker-compose logs api --tail=100 | Select-String -Pattern "database|sql|connection|error"
```

### Verify network connectivity
```powershell
# From API container, test if it can reach SQL Server
docker exec invoiceapp-api ping -c 3 sqlserver
```

### Check if SQL Server is accepting connections
```powershell
# Test connection from within SQL Server container
docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION"
```

### Verify connection string is correct
```powershell
# Check environment variables in API container
docker exec invoiceapp-api printenv | Select-String -Pattern "CONNECTION"
```

## Expected Connection String

### For API Container (inside Docker):
```
CONNECTION_STRING=Server=sqlserver,1433;Database=InvoiceApp;User Id=sa;Password=YourStrong@Password123;TrustServerCertificate=true;MultipleActiveResultSets=true;Connect Timeout=60;Command Timeout=60;Pooling=true
```
Note: Uses service name `sqlserver` and internal port `1433`.

### For SSMS Connection (from Windows):
```
Server: localhost,1434
Username: sa
Password: YourStrong@Password123
```
Note: Uses `localhost` and external port `1434`.

## Important Notes

- **First startup takes longer**: SQL Server container takes 60-90 seconds to become fully ready
- **API will wait**: The API will retry connections up to 90 seconds, so the first startup might take 2-3 minutes total
- **Subsequent starts are faster**: After the first run, SQL Server starts faster because the database is already initialized
