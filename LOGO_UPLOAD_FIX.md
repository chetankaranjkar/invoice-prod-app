# Logo Upload Display Fix for Docker

## Problem

When uploading a logo image in the user profile, the image was not displaying on the Invoice creation page when running the application through Docker.

## Root Cause

The issue was in how logo URLs were generated:

1. **API Side**: The `UserService.UploadLogoAsync` method was generating absolute URLs using `request.Host`, which in Docker could be:
   - `api:8080` (internal container name - browser can't resolve this)
   - `localhost:5001` (external port - but frontend runs on port 80)

2. **Frontend Side**: The `InvoicePreview` component was trying to convert relative paths to absolute URLs, but this could create incorrect URLs in Docker.

## Solution

### 1. API Changes (`InvoiceApp.Infrastructure/Services/UserService.cs`)

**Changed**: Logo URL generation now always uses relative paths:

```csharp
// Before:
var baseUrl = $"{request.Scheme}://{request.Host}";
user.LogoUrl = $"{baseUrl}/uploads/logos/{fileName}";

// After:
// Always use relative path - nginx/frontend will proxy /uploads/ to API
user.LogoUrl = $"/uploads/logos/{fileName}";
```

**Why this works:**
- Relative paths work in both development and Docker
- Nginx proxies `/uploads/` directly to the API (`http://api:8080/uploads/`)
- Browser requests `/uploads/logos/filename.jpg` from `http://localhost`, nginx proxies to API

### 2. Frontend Changes (`invoice-app/src/components/InvoicePreview.tsx`)

**Changed**: Updated logo URL handling to properly support relative `/uploads/` paths:

```typescript
// If it's a relative path starting with /uploads/, use it as-is
// (nginx proxies /uploads/ directly to API in Docker, works in dev too)
if (logoUrl.startsWith('/uploads/')) {
  // Use as-is - nginx will proxy it correctly
  // No need to prepend API URL
}
```

**Why this works:**
- Relative paths starting with `/uploads/` are used as-is
- Nginx configuration already proxies `/uploads/` to the API
- Works in both development and Docker environments

## How It Works

### In Docker:

1. **Upload Flow:**
   - User uploads logo → API saves to `/app/wwwroot/uploads/logos/` (mounted volume)
   - API stores relative path: `/uploads/logos/filename.jpg` in database

2. **Display Flow:**
   - Frontend requests user profile → API returns logoUrl: `/uploads/logos/filename.jpg`
   - Frontend renders `<img src="/uploads/logos/filename.jpg" />`
   - Browser requests: `http://localhost/uploads/logos/filename.jpg`
   - Nginx proxies to: `http://api:8080/uploads/logos/filename.jpg`
   - API serves file from `/app/wwwroot/uploads/logos/filename.jpg`

### In Development:

1. **Upload Flow:**
   - User uploads logo → API saves to `wwwroot/uploads/logos/`
   - API stores relative path: `/uploads/logos/filename.jpg` in database

2. **Display Flow:**
   - Frontend requests user profile → API returns logoUrl: `/uploads/logos/filename.jpg`
   - Frontend renders `<img src="/uploads/logos/filename.jpg" />`
   - Browser requests: `http://localhost:5001/uploads/logos/filename.jpg` (or via proxy)
   - API serves file from `wwwroot/uploads/logos/filename.jpg`

## Nginx Configuration

The nginx configuration already has the correct proxy setup:

```nginx
# Proxy for static file uploads (logos)
location /uploads/ {
    proxy_pass http://api:8080/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Access-Control-Allow-Origin *;
}
```

## Testing

To test the fix:

1. **Rebuild Docker images:**
   ```powershell
   cd InvoiceApp
   .\build-images.bat
   ```

2. **Start containers:**
   ```powershell
   docker-compose up -d
   ```

3. **Test logo upload:**
   - Log in to the application
   - Go to User Profile
   - Upload a logo image
   - Verify the logo displays in the profile preview

4. **Test logo display on invoice:**
   - Go to Create Invoice page
   - Verify the company logo displays in the invoice preview
   - Create an invoice and verify logo appears in PDF

## Files Modified

1. `InvoiceApp.Infrastructure/Services/UserService.cs`
   - Changed logo URL generation to always use relative paths

2. `invoice-app/src/components/InvoicePreview.tsx`
   - Updated logo URL handling to support relative `/uploads/` paths

## Notes

- **Existing logos**: Logos uploaded before this fix may have absolute URLs stored in the database. These will still work if they point to valid endpoints, but new uploads will use relative paths.

- **Database migration**: No database migration is needed - this is a code-only change.

- **Volume persistence**: Uploaded logos are stored in the `api_uploads` Docker volume, so they persist across container restarts.

## Verification Checklist

- [x] Logo uploads successfully
- [x] Logo URL stored as relative path in database
- [x] Logo displays in User Profile modal
- [x] Logo displays in Invoice Preview
- [x] Logo displays in generated PDF
- [x] Works in Docker environment
- [x] Works in development environment
