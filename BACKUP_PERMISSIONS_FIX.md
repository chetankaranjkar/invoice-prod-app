# Backup Permissions Fix

## Problem

When creating a backup, you may see this error:
```
SQL Server error: Cannot open backup device '/var/opt/mssql/backup/...'. 
Operating system error 5(Access is denied.).
```

This happens because SQL Server doesn't have write permissions to the shared backup volume.

## Solution

### Option 1: Run the Fix Script (Recommended)

Run the permission fix script:

```cmd
fix-backup-permissions.bat
```

Or PowerShell:
```powershell
.\fix-backup-permissions.ps1
```

This will:
- Create the backup directory if it doesn't exist
- Set proper permissions (777)
- Set ownership to mssql user

### Option 2: Manual Fix

Run this command manually:

```cmd
docker exec invoiceapp-db bash -c "mkdir -p /var/opt/mssql/backup && chmod 777 /var/opt/mssql/backup && chown mssql:mssql /var/opt/mssql/backup"
```

### Option 3: Automatic Fix (Already Included)

The `install-from-pendrive.bat` script now automatically fixes permissions when installing.

## How It Works

The backup service will:
1. **First try** to backup to `/var/opt/mssql/backup` (shared volume)
2. **If that fails** due to permissions, it will backup to `/var/opt/mssql/data` (SQL Server's data directory)
3. **Then copy** the backup file from data directory to shared volume using docker exec
4. **Finally copy** from shared volume to the backup ZIP

## Verification

After running the fix script, verify it worked:

```cmd
docker exec invoiceapp-db ls -la /var/opt/mssql/backup
```

You should see the directory exists and has proper permissions.

## When to Run

- **After first installation** - Run `fix-backup-permissions.bat` once
- **After recreating containers** - Permissions may be reset
- **If backup fails** - Run the fix script and try again

## Notes

- The fix script needs to be run **after** SQL Server container is running
- Permissions are set to 777 to allow SQL Server to write
- The backup will work automatically once permissions are fixed
- You only need to run this once (unless containers are recreated)
