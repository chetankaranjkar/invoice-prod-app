# ✅ CORRECT ACCESS URLs

## According to docker-compose.yml:

- **Frontend:** http://localhost (Port 80, NOT 3000)
- **API:** http://localhost:5001 (NOT 8080)
- **Swagger:** http://localhost:5001/swagger (NOT 8080/swagger)
- **Health Check:** http://localhost:5001/health

## Port Mappings:

- **Frontend:** Host port `80` → Container port `80`
- **API:** Host port `5001` → Container port `8080` (internal)
- **SQL Server:** Host port `1433` → Container port `1433`

## If API is not accessible on http://localhost:5001:

### Step 1: Check if API container is running

```bash
docker-compose ps api
```

### Step 2: Check API logs

```bash
docker-compose logs api --tail=50
```

### Step 3: Test health endpoint

```bash
curl http://localhost:5001/health
```

### Step 4: If curl fails, check if container is accessible internally

```bash
docker exec invoiceapp-api curl http://localhost:8080/health
```

### Step 5: Check if port 5001 is in use

```bash
# Windows
netstat -ano | findstr :5001

# Linux/Mac
lsof -i :5001
```

### Step 6: If port is in use, change it in docker-compose.yml:

```yaml
api:
  ports:
    - "5002:8080" # Change from 5001 to 5002
```

### Step 7: Restart services

```bash
docker-compose restart api
# Or
docker-compose down
docker-compose up -d
```
