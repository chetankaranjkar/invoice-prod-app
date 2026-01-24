# Backup & Restore Guide

This guide explains how to use the backup and restore features in InvoiceApp.

## Overview

The backup system allows you to:
- **Create backups** of all data (database + uploaded files)
- **Restore from backups** to recover data after volume deletion or data loss
- **Download backup files** for safekeeping
- **Upload and restore** backup files through the web interface

## Accessing Backup & Restore

1. **Login** as Admin or MasterUser
2. **Navigate** to "Backup & Restore" in the navigation menu
3. You'll see options to create backups and restore from backups

## Creating a Backup

### Via Web Interface (Recommended)

1. Go to **Backup & Restore** page
2. Click **"Create Backup"** button
3. Wait for the backup to be created (may take a few minutes)
4. The backup ZIP file will automatically download
5. Save the backup file in a safe location

### Via Command Line Script

Run the backup script:
```cmd
backup-data.bat
```

This will:
- Create a database backup (.bak file)
- Copy all uploaded files
- Create a ZIP archive in the `backups` folder

## Restoring from Backup

### Via Web Interface (Recommended)

1. Go to **Backup & Restore** page
2. Click **"Select Backup File"** button
3. Choose your backup ZIP file
4. Confirm the restore (you'll be warned twice - this replaces ALL data)
5. Wait for restore to complete
6. The page will automatically refresh to show restored data

### Via Command Line Script

Run the restore script:
```cmd
restore-data.bat
```

Follow the prompts to:
- Select your backup file
- Confirm the restore
- Wait for database and files to be restored

## Backup File Contents

Each backup ZIP file contains:
- `database/InvoiceApp.bak` - SQL Server database backup
- `uploads/` - All uploaded files (logos, etc.)

## Important Notes

### ⚠️ Warnings

1. **Restore replaces ALL data** - Current data will be permanently deleted
2. **Always create a backup before restoring** - You may lose current data
3. **Backup files are large** - Database backups can be several hundred MB
4. **Restore takes time** - Large databases may take 5-10 minutes to restore

### ✅ Best Practices

1. **Regular backups** - Create backups daily or weekly
2. **Store backups safely** - Keep backup files on external drives or cloud storage
3. **Test restores** - Periodically test that your backups can be restored
4. **Version backups** - Keep multiple backup versions (daily, weekly, monthly)

## Docker Volume Recovery

If Docker volumes are accidentally deleted, you can restore data using backup files:

1. **Stop containers**:
   ```cmd
   docker-compose down
   ```

2. **Restore using script**:
   ```cmd
   restore-data.bat
   ```

3. **Or restore via web interface** after starting containers

## Troubleshooting

### Backup Creation Fails

- **Check disk space** - Ensure you have enough free space
- **Check Docker volumes** - Ensure volumes are mounted correctly
- **Check logs** - Review API logs for errors: `docker-compose logs api`

### Restore Fails

- **Verify backup file** - Ensure the ZIP file is not corrupted
- **Check file size** - Ensure backup file is complete
- **Check database connection** - Ensure SQL Server is running
- **Check permissions** - Ensure API has write access to volumes

### Database Restore Issues

If database restore fails:
1. Check SQL Server logs: `docker-compose logs sqlserver`
2. Verify backup file is accessible in shared volume
3. Try restoring using the command-line script instead

## Backup File Locations

- **Web backups**: Stored in `wwwroot/backups/` inside API container
- **Script backups**: Stored in `backups/` folder in project directory
- **Downloaded backups**: Saved to your Downloads folder

## API Endpoints

For programmatic access:

- `POST /api/Backup/create` - Create backup (returns ZIP file)
- `POST /api/Backup/restore` - Restore from backup (requires file upload)
- `GET /api/Backup/list` - List available backups

All endpoints require Admin or MasterUser authentication.

## Support

If you encounter issues:
1. Check container logs: `docker-compose logs`
2. Verify volumes exist: `docker volume ls`
3. Check backup file integrity
4. Review this guide for common solutions
