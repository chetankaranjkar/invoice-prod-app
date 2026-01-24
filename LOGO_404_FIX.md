# Fix for Logo 404 Error in Docker

## Problem
Logo images return 404 error when accessed via `http://localhost/uploads/logos/...` even though files exist in Docker volumes.

## Root Cause
The middleware order in ASP.NET Core was incorrect. `UseRouting()` was called before `UseStaticFiles()`, causing routing to intercept requests before static files could be served.

## Solution Applied

### 1. Fixed Middleware Order (`Program.cs`)
- Moved `UseStaticFiles()` **before** `UseRouting()`
- Static files must be served before routing to avoid conflicts
- This ensures `/uploads/logos/file.jpg` requests are handled by static files middleware, not routing

### 2. Enhanced Nginx Configuration (`nginx.conf`)
- Added `proxy_buffering off;` for better image performance
- Ensured proper CORS headers for static files

### 3. Added Debug Endpoint
- Added `/debug/uploads` endpoint to check if files exist in the container
- Access via: `http://localhost:5001/debug/uploads` or `http://localhost/api/debug/uploads`

## Testing Steps

### Step 1: Rebuild and Restart
```powershell
cd InvoiceApp
.\build-images.bat
docker-compose restart api frontend
```

### Step 2: Verify Files Exist
```powershell
# Check files in container
docker-compose exec api ls -la /app/wwwroot/uploads/logos

# Or use debug endpoint
curl http://localhost:5001/debug/uploads
```

### Step 3: Test Direct API Access
```powershell
# Test if API can serve the file directly
curl -I http://localhost:5001/uploads/logos/[your-filename].jpg
```

### Step 4: Test Through Nginx Proxy
```powershell
# Test if nginx proxies correctly
curl -I http://localhost/uploads/logos/[your-filename].jpg
```

### Step 5: Check Browser
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to load invoice page
4. Check if logo request returns 200 OK

## Expected Behavior

### Before Fix
- Request: `http://localhost/uploads/logos/file.jpg`
- Response: 404 Not Found
- Reason: Routing intercepted request before static files middleware

### After Fix
- Request: `http://localhost/uploads/logos/file.jpg`
- Nginx: Proxies to `http://api:8080/uploads/logos/file.jpg`
- API: Static files middleware serves from `wwwroot/uploads/logos/file.jpg`
- Response: 200 OK with image data

## Verification

After applying the fix:
1. ✅ Static files middleware runs before routing
2. ✅ Files are accessible via direct API: `http://localhost:5001/uploads/logos/...`
3. ✅ Files are accessible via nginx proxy: `http://localhost/uploads/logos/...`
4. ✅ Logo displays correctly on invoice page
5. ✅ No 404 errors in browser console

## Common Issues

### Issue: Still getting 404
**Check:**
- Files exist: `docker-compose exec api ls -la /app/wwwroot/uploads/logos`
- Volume mounted: `docker volume inspect invoiceapp_api_uploads`
- API logs: `docker-compose logs api | grep -i static`
- Restart containers: `docker-compose restart`

### Issue: Files not in volume
**Fix:**
- Re-upload logo after restart
- Check volume mount in `docker-compose.yml`: `api_uploads:/app/wwwroot/uploads`

### Issue: CORS error
**Fix:**
- Already handled in static files configuration
- Check browser console for specific CORS error

## Files Changed
1. `InvoiceApp.Api/Program.cs` - Fixed middleware order
2. `invoice-app/nginx.conf` - Enhanced proxy configuration
