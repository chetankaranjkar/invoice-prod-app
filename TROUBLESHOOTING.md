# Troubleshooting Guide - Invoice Master Docker

## Port Access Issues

### Correct Access URLs:

- **Frontend:** http://localhost (NOT http://localhost:3000)
- **API:** http://localhost:5001 (NOT http://localhost:8080)
- **Swagger:** http://localhost:5001/swagger (NOT http://localhost:8080/swagger)

### If API is not accessible on port 5001:

1. **Check if containers are running:**

   ```bash
   docker-compose ps
   ```

   All services should show "Up" status.

2. **Check API container logs:**

   ```bash
   docker-compose logs api
   ```

   Look for errors, especially database connection issues.

3. **Check if port 5001 is in use:**

   ```bash
   # Windows
   netstat -ano | findstr :5001

   # Linux/Mac
   lsof -i :5001
   ```

   If port is in use, change it in docker-compose.yml

4. **Test API health endpoint:**

   ```bash
   curl http://localhost:5001/health
   ```

   Should return: `{"status":"healthy","timestamp":"..."}`

5. **Check if API container is accessible from host:**

   ```bash
   docker exec invoiceapp-api curl http://localhost:8080/health
   ```

6. **If API container is not running, check logs:**
   ```bash
   docker-compose logs api --tail=100
   ```

### Common Issues:

**Issue: "localhost refused to connect" on port 5001**

- **Solution:** API container might not be running or crashed
  ```bash
  docker-compose logs api
  docker-compose restart api
  ```

**Issue: "Port already in use"**

- **Solution:** Change port in docker-compose.yml:
  ```yaml
  api:
    ports:
      - "5002:8080" # Change 5001 to 5002
  ```

**Issue: API container keeps restarting**

- **Solution:** Check database connection:
  ```bash
  docker-compose logs api | grep -i "database\|connection\|error"
  ```

**Issue: Database connection timeout**

- **Solution:** Wait for SQL Server to fully start (takes 60-90 seconds):
  ```bash
  docker-compose logs sqlserver
  docker-compose ps sqlserver  # Check if healthy
  ```

## Quick Diagnostic Commands:

```bash
# Check all container status
docker-compose ps

# Check API logs
docker-compose logs api --tail=50

# Check API container internal health
docker exec invoiceapp-api curl http://localhost:8080/health

# Check if port 5001 is listening
# Windows:
netstat -ano | findstr :5001

# Linux/Mac:
ss -tlnp | grep :5001
```

## Reset Everything:

```bash
# Stop and remove everything
docker-compose down -v

# Rebuild and start
docker-compose build --no-cache
docker-compose up -d

# Watch logs
docker-compose logs -f
```
