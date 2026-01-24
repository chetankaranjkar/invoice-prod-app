# Logo Display Debugging Guide

## Issue
Logo images are not displaying when running the application through Docker, showing "no logo available" error.

## Root Cause Analysis

The issue occurs because:
1. **Old logo URLs**: Existing logos in the database may have absolute URLs like `http://api:8080/uploads/logos/...` which browsers can't resolve
2. **Path resolution**: In Docker, relative paths need to be handled differently than in development
3. **Nginx proxy**: The nginx proxy should forward `/uploads/` to the API, but there might be a configuration issue

## Solutions Applied

### 1. API Changes (`UserService.cs`)
- Changed to always store relative paths: `/uploads/logos/filename.jpg`
- This ensures new uploads work correctly

### 2. Frontend Changes (`InvoicePreview.tsx`)
- Updated to handle relative `/uploads/` paths correctly
- Handles both Docker mode (VITE_API_URL = `/api/`) and Dev mode

### 3. Static Files Configuration (`Program.cs`)
- Ensured static files are served from `wwwroot` folder
- Added CORS headers for static files

## Testing Steps

### Step 1: Check if files exist in container
```powershell
docker-compose exec api ls -la /app/wwwroot/uploads/logos
```

### Step 2: Check if static files are accessible
```powershell
# Test from API container
docker-compose exec api curl http://localhost:8080/uploads/logos/[filename]
```

### Step 3: Check nginx proxy
```powershell
# Test from frontend container
docker-compose exec frontend wget -O- http://api:8080/uploads/logos/[filename]
```

### Step 4: Check browser console
- Open browser DevTools (F12)
- Go to Network tab
- Try to load invoice page
- Check if logo request is made and what the response is

### Step 5: Verify logo URL in database
```sql
-- Connect to SQL Server
SELECT Id, Email, LogoUrl FROM Users WHERE LogoUrl IS NOT NULL;
```

## Common Issues and Fixes

### Issue 1: Logo URL is absolute with container hostname
**Symptom**: Logo URL is `http://api:8080/uploads/logos/...`
**Fix**: Re-upload the logo to get a new relative path URL

### Issue 2: File doesn't exist
**Symptom**: 404 error when accessing logo
**Fix**: 
- Check if file exists: `docker-compose exec api ls -la /app/wwwroot/uploads/logos`
- Check volume mount: `docker volume inspect invoiceapp_api_uploads`

### Issue 3: Nginx proxy not working
**Symptom**: Request to `/uploads/` returns 404 from nginx
**Fix**: 
- Check nginx config: `docker-compose exec frontend cat /etc/nginx/conf.d/default.conf`
- Restart frontend: `docker-compose restart frontend`

### Issue 4: CORS error
**Symptom**: CORS error in browser console
**Fix**: Already handled in static files configuration

## Quick Fix for Existing Logos

If you have existing logos with absolute URLs, you can update them:

```sql
-- Update all logo URLs to relative paths
UPDATE Users 
SET LogoUrl = REPLACE(LogoUrl, 'http://api:8080', '')
WHERE LogoUrl LIKE 'http://api:8080%';

UPDATE Users 
SET LogoUrl = REPLACE(LogoUrl, 'http://localhost:5001', '')
WHERE LogoUrl LIKE 'http://localhost:5001%';

UPDATE Users 
SET LogoUrl = REPLACE(LogoUrl, 'https://localhost:7001', '')
WHERE LogoUrl LIKE 'https://localhost:7001%';
```

## Verification

After applying fixes:
1. Rebuild images: `.\build-images.bat`
2. Restart containers: `docker-compose restart`
3. Upload a new logo
4. Check if it displays on invoice page
5. Check browser console for any errors
