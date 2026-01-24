# Invoice Master - Docker Deployment Guide

This guide will help you run the Invoice Master application using Docker for easy deployment and demonstration.

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** + **Docker Compose** (Linux)
  - Download from: https://www.docker.com/products/docker-desktop
- At least **4GB RAM** available for Docker
- **5GB free disk space**

## Quick Start

1. **Clone or extract the project** to your machine

2. **Open a terminal** in the project root directory (where `docker-compose.yml` is located)

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to start** (first time may take 2-3 minutes to build images)

5. **Access the application**:
   - Frontend: http://localhost
   - API Swagger: http://localhost:5001/swagger
   - SQL Server: localhost:1433

## Services Overview

The Docker setup includes:

1. **SQL Server Database** (`sqlserver`)
   - Port: `1433`
   - Default credentials: `sa` / `YourStrong@Password123`
   - Data persisted in Docker volume

2. **API Backend** (`api`)
   - Port: `5001`
   - Built from ASP.NET Core 8.0
   - Automatically runs database migrations on startup
   - Serves uploaded files (logos) from persistent volume

3. **Frontend** (`frontend`)
   - Port: `80`
   - React application served via Nginx
   - Proxies API requests to backend

## Default Login Credentials

After first startup, the application automatically seeds the database with default users:

- **Master User** (Highest Privileges):
  - Email: `chetan.karanjkar@gmail.com`
  - Password: `Medrio@1234`
  - Role: MasterUser
  - **Note:** MasterUser can only manage Admin users. They cannot create invoices directly.

## Configuration

### Environment Variables

You can customize the configuration by creating a `docker-compose.override.yml` file:

```yaml
version: '3.8'

services:
  sqlserver:
    environment:
      - SA_PASSWORD=YourCustomPassword123!
    ports:
      - "14330:1433"

  api:
    environment:
      - CONNECTION_STRING=Server=sqlserver;Database=InvoiceApp;User Id=sa;Password=YourCustomPassword123!;TrustServerCertificate=true
      - JWT__SECRET=YourProductionJWTSecretKey
    ports:
      - "5002:8080"

  frontend:
    ports:
      - "8080:80"
```

**Note**: After changing `docker-compose.override.yml`, restart services:
```bash
docker-compose down
docker-compose up -d
```

### Changing SQL Server Password

1. Create `docker-compose.override.yml` with your custom password
2. Update the `CONNECTION_STRING` in the API service
3. Restart services

### Changing API Port

Edit `docker-compose.override.yml`:
```yaml
api:
  ports:
    - "YOUR_PORT:8080"
```

### Changing Frontend Port

Edit `docker-compose.override.yml`:
```yaml
frontend:
  ports:
    - "YOUR_PORT:80"
```

## Common Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ Deletes all data)
```bash
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f sqlserver
```

### Rebuild Images
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Check Service Status
```bash
docker-compose ps
```

### Execute Commands in Containers

**API Container:**
```bash
docker-compose exec api bash
```

**SQL Server Container:**
```bash
docker-compose exec sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123
```

**Frontend Container:**
```bash
docker-compose exec frontend sh
```

## Troubleshooting

### Services won't start

1. **Check Docker is running**:
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Check ports are available**:
   - Port 80: Frontend
   - Port 5001: API
   - Port 1433: SQL Server
   
   If ports are in use, modify ports in `docker-compose.override.yml`

3. **View logs for errors**:
   ```bash
   docker-compose logs
   ```

### Database connection errors

1. **Wait for SQL Server to be healthy** (first startup takes 30-60 seconds)
   ```bash
   docker-compose ps
   ```
   Check that `sqlserver` shows `healthy` status

2. **Check connection string** in API logs:
   ```bash
   docker-compose logs api | grep -i connection
   ```

### API returns 500 errors

1. **Check if database migrations ran**:
   ```bash
   docker-compose logs api | grep -i migration
   ```

2. **Manually run migrations** (if needed):
   ```bash
   docker-compose exec api dotnet ef database update --project /src/InvoiceApp.Infrastructure --startup-project /src/InvoiceApp.Api
   ```

### Frontend can't connect to API

1. **Check API is running**:
   ```bash
   docker-compose ps api
   curl http://localhost:5001/health
   ```

2. **Check nginx configuration** in frontend container:
   ```bash
   docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
   ```

3. **Verify CORS settings** in API logs:
   ```bash
   docker-compose logs api | grep -i cors
   ```

### Images not appearing in invoices

1. **Check uploads volume**:
   ```bash
   docker-compose exec api ls -la /app/wwwroot/uploads/logos
   ```

2. **Check volume permissions**:
   ```bash
   docker-compose exec api chmod -R 755 /app/wwwroot/uploads
   ```

### Reset Everything (Start Fresh)

```bash
# Stop and remove everything
docker-compose down -v

# Remove all images
docker-compose rm -f
docker rmi invoiceapp-api invoiceapp-frontend

# Rebuild and start
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production deployment, consider:

1. **Change all default passwords**:
   - SQL Server SA password
   - JWT Secret key

2. **Use environment variables** instead of hardcoded values:
   ```bash
   export SA_PASSWORD="YourSecurePassword123!"
   export JWT_SECRET="YourVeryLongRandomJWTSecretKey"
   docker-compose up -d
   ```

3. **Enable HTTPS**:
   - Add SSL certificates
   - Configure Nginx for HTTPS
   - Update API to use HTTPS

4. **Set up backups**:
   - Regular database backups
   - Backup uploads volume

5. **Resource limits**:
   ```yaml
   services:
     api:
       deploy:
         resources:
           limits:
             memory: 512M
             cpus: '0.5'
   ```

## Data Persistence

All data is stored in Docker volumes:
- `sqlserver_data`: Database files
- `api_uploads`: Uploaded logos and files

To backup data:
```bash
# Backup database
docker-compose exec sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Password123 -Q "BACKUP DATABASE InvoiceApp TO DISK='/var/opt/mssql/backup/InvoiceApp.bak'"

# Copy backup out
docker cp invoiceapp-db:/var/opt/mssql/backup/InvoiceApp.bak ./backup.bak
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Verify service health: `docker-compose ps`
3. Review this README for common solutions

---

**Happy Invoicing! 🚀**
