# Backup Restore 413 Error Fix

## Problem

When trying to restore a backup, you may see this error:
```
❌ API Error: 413 Backup/restore
Error restoring backup: br
```

A **413 error** means "Payload Too Large" - the backup file being uploaded exceeds the default request size limit.

## Solution

The API has been configured to accept larger file uploads (up to 1GB) for backup restore operations.

### Changes Made

1. **Kestrel Server Configuration** - Increased `MaxRequestBodySize` to 1GB
2. **Form Options Configuration** - Increased `MultipartBodyLengthLimit` to 1GB
3. **Controller Attribute** - Added `[DisableRequestSizeLimit]` to the restore endpoint
4. **File Size Validation** - Updated validation to allow up to 1GB files

### Configuration Details

**Program.cs:**
- Kestrel `MaxRequestBodySize`: 1GB
- Form `MultipartBodyLengthLimit`: 1GB

**BackupController.cs:**
- `[DisableRequestSizeLimit]` attribute on restore endpoint
- File size validation: 1GB maximum

## Testing

After rebuilding the API container, try restoring a backup again. The 413 error should be resolved.

## Rebuild Required

Since this changes the API code, you need to rebuild the API container:

```cmd
docker-compose build api
docker-compose up -d api
```

Or rebuild everything:

```cmd
docker-compose build
docker-compose up -d
```

## Notes

- Maximum backup file size is now **1GB**
- If you need larger backups, you can increase the limits in `Program.cs`
- The limits are set at:
  - Kestrel server level
  - Form options level
  - Controller level (disabled for restore endpoint)

## Troubleshooting

If you still get 413 errors:

1. **Check file size** - Ensure your backup file is under 1GB
2. **Rebuild containers** - Make sure the API container was rebuilt with the new configuration
3. **Check logs** - Review API logs for any other errors:
   ```cmd
   docker-compose logs api
   ```
4. **Increase limits** - If needed, increase the limits in `Program.cs` (currently 1GB)
