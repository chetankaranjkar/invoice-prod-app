# SQL Server Connection Guide

## Port Configuration

The SQL Server container is configured to use:
- **External Port (from your Windows machine)**: `1434`
- **Internal Port (between Docker containers)**: `1433`

This allows the Docker SQL Server to run alongside your local SQL Server instance on port 1433.

## Connecting from SQL Server Management Studio (SSMS)

### Connection Details:

1. **Server name**: `localhost,1434`
   - OR just: `localhost\SQLExpress` won't work - use `localhost,1434`
   
2. **Authentication**: SQL Server Authentication

3. **Login**: `sa`

4. **Password**: `YourStrong@Password123`

5. **Database** (optional): Leave empty or select `master` initially

### Step-by-Step:

1. Open SQL Server Management Studio (SSMS)
2. In the "Connect to Server" dialog:
   - **Server type**: Database Engine
   - **Server name**: `localhost,1434` ← **Important: Use port 1434**
   - **Authentication**: SQL Server Authentication
   - **Login**: `sa`
   - **Password**: `YourStrong@Password123`
   - **Remember password**: (optional)
3. Click **Connect**

## Verifying SQL Server Container is Running

Before connecting, make sure the container is running:

```powershell
docker ps | Select-String invoiceapp-db
```

Or check status:
```powershell
docker-compose ps sqlserver
```

If not running, start it:
```powershell
docker-compose up -d sqlserver
```

Wait 60-90 seconds for SQL Server to fully initialize.

## Testing Connection from Command Line

You can test the connection using `sqlcmd` (if installed):

```powershell
sqlcmd -S localhost,1434 -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION"
```

Or using Docker (SQL Server 2022 uses different path):

```powershell
# Try this first (SQL Server 2022)
docker exec invoiceapp-db sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION"

# Or try alternative paths:
docker exec invoiceapp-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION"
docker exec invoiceapp-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Password123" -Q "SELECT @@VERSION"
```

## Common Issues

### Error: "Cannot connect to localhost,1434"
- **Solution**: Make sure the Docker container is running: `docker-compose ps sqlserver`
- **Solution**: Wait 60-90 seconds after starting the container for SQL Server to initialize

### Error: "Login failed for user 'sa'"
- **Solution**: Verify password is exactly: `YourStrong@Password123` (case-sensitive)

### Error: "The server was not found or was not accessible"
- **Solution**: Check if port 1434 is available: `netstat -ano | findstr :1434`
- **Solution**: If port is in use, you can change it in `docker-compose.yml` to another port (e.g., `1435:1433`)

### Still using port 1433 instead of 1434?
- **Issue**: You might be trying to connect to your local SQL Server instead of the Docker one
- **Solution**: Always use `localhost,1434` (with comma) when connecting to the Docker SQL Server

## Changing the Port (if needed)

If port 1434 is also in use, you can change it in `docker-compose.yml`:

```yaml
ports:
  - "1435:1433"  # Change 1435 to any available port
```

Then use `localhost,1435` in SSMS connection string.

## Important Notes

- **Inside Docker**: Containers connect using service name `sqlserver` on port `1433` (internal)
- **From Windows**: Connect using `localhost,1434` (external port)
- **Password**: `YourStrong@Password123` is case-sensitive
- **First startup**: SQL Server takes 60-90 seconds to become ready
