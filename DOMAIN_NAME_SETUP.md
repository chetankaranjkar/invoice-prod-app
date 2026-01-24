# Domain Name Setup Guide

This guide explains how to access the InvoiceApp using a friendly domain name (`invoiceapp.local`) instead of `localhost:3000`.

## Overview

After setup, you can access the application using:
- **Frontend**: `http://invoiceapp.local:3000` (instead of `http://localhost:3000`)
- **API**: `http://localhost:5000` (unchanged)
- **Swagger**: `http://localhost:5000/swagger` (unchanged)

## Quick Setup (Windows)

### Option 1: Automated Setup (Recommended)

1. **Run the setup script** (requires Administrator privileges):
   ```cmd
   setup-domain.bat
   ```
   
   Or double-click `setup-domain.bat` in Windows Explorer.

2. The script will:
   - Check if you're running as Administrator
   - Add `invoiceapp.local` to your hosts file
   - Create a backup of your hosts file

### Option 2: Manual Setup

1. **Open Notepad as Administrator**:
   - Press `Win + X`
   - Select "Windows PowerShell (Admin)" or "Terminal (Admin)"
   - Type: `notepad C:\Windows\System32\drivers\etc\hosts`

2. **Add the following line** at the end of the file:
   ```
   127.0.0.1    invoiceapp.local
   ```

3. **Save the file** (Ctrl+S)

## Verification

After setup, verify it works:

1. **Test the domain resolution**:
   ```cmd
   ping invoiceapp.local
   ```
   You should see it resolve to `127.0.0.1`

2. **Start Docker containers**:
   ```cmd
   docker-compose up -d
   ```

3. **Open your browser** and navigate to:
   ```
   http://invoiceapp.local:3000
   ```

## Troubleshooting

### Domain not resolving?

1. **Clear DNS cache**:
   ```cmd
   ipconfig /flushdns
   ```

2. **Check hosts file**:
   - Make sure the entry exists: `127.0.0.1    invoiceapp.local`
   - No typos or extra spaces
   - File was saved correctly

3. **Restart browser** after making changes

### CORS errors?

- Make sure the domain is added to CORS allowed origins (already configured in `docker-compose.yml` and `appsettings.json`)
- Restart Docker containers after any CORS configuration changes:
  ```cmd
  docker-compose restart api
  ```

### Port 3000 still required?

Yes, we're using port 3000 to avoid conflicts with port 80. The domain name makes it easier to remember, but the port is still needed:
- `http://invoiceapp.local:3000` ✅
- `http://invoiceapp.local` ❌ (won't work)

## Removing the Domain

To remove the domain from your hosts file:

1. **Open hosts file as Administrator**:
   ```cmd
   notepad C:\Windows\System32\drivers\etc\hosts
   ```

2. **Find and delete the line**:
   ```
   127.0.0.1    invoiceapp.local
   ```

3. **Save the file**

4. **Clear DNS cache**:
   ```cmd
   ipconfig /flushdns
   ```

## Technical Details

### What Changed?

1. **nginx.conf**: Updated `server_name` to accept `invoiceapp.local`
2. **CORS Settings**: Added `http://invoiceapp.local:3000` to allowed origins
3. **Hosts File**: Maps `invoiceapp.local` to `127.0.0.1`

### Files Modified

- `invoice-app/nginx.conf` - Added domain name to server_name
- `docker-compose.yml` - Added domain to CORS environment variables
- `InvoiceApp.Api/appsettings.json` - Added domain to CORS allowed origins
- `InvoiceApp.Api/Program.cs` - Updated default CORS origins

### Why Port 3000?

We use port 3000 instead of port 80 to avoid conflicts with:
- Windows IIS (Internet Information Services)
- Other web servers
- System services that may use port 80

The domain name makes it easier to remember, but the port is still required.

## Alternative Domain Names

If you prefer a different domain name, you can:

1. **Edit the setup script** (`setup-domain.ps1`) and change:
   ```powershell
   $domain = "yourdomain.local"
   ```

2. **Update nginx.conf**:
   ```nginx
   server_name yourdomain.local localhost;
   ```

3. **Update CORS settings** in:
   - `docker-compose.yml`
   - `appsettings.json`
   - `Program.cs`

4. **Run the setup script** again

## Support

If you encounter issues:
1. Check that Docker containers are running: `docker-compose ps`
2. Verify hosts file entry exists
3. Clear DNS cache: `ipconfig /flushdns`
4. Restart Docker containers: `docker-compose restart`
