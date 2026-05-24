using InvoiceApp.Application.Interfaces;
using InvoiceApp.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;

namespace InvoiceApp.Infrastructure.Services
{
    public class BackupService : IBackupService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BackupService> _logger;
        private readonly AppDbContext _dbContext;
        private readonly string _backupDirectory;
        private readonly string _uploadsDirectory;

        public BackupService(IConfiguration configuration, ILogger<BackupService> logger, AppDbContext dbContext)
        {
            _configuration = configuration;
            _logger = logger;
            _dbContext = dbContext;
            
            // Set backup directory (relative to wwwroot or absolute path)
            var wwwrootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            _backupDirectory = Path.Combine(wwwrootPath, "backups");
            _uploadsDirectory = Path.Combine(wwwrootPath, "uploads");

            // Ensure backup directory exists
            if (!Directory.Exists(_backupDirectory))
            {
                Directory.CreateDirectory(_backupDirectory);
            }
        }

        public async Task<BackupResult> CreateBackupAsync()
        {
            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var backupFileName = $"invoiceapp-backup-{timestamp}.zip";
                var backupFilePath = Path.Combine(_backupDirectory, backupFileName);

                // Create temporary directory for backup contents
                var tempBackupDir = Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid()}");
                Directory.CreateDirectory(tempBackupDir);
                var dbBackupDir = Path.Combine(tempBackupDir, "database");
                var uploadsBackupDir = Path.Combine(tempBackupDir, "uploads");
                Directory.CreateDirectory(dbBackupDir);
                Directory.CreateDirectory(uploadsBackupDir);

                try
                {
                    // Step 1: Backup database
                    _logger.LogInformation("Creating database backup...");
                    var dbBackupResult = await BackupDatabaseAsync(dbBackupDir);
                    if (!dbBackupResult.Success)
                    {
                        _logger.LogWarning("Database backup failed: {Error}. Continuing with file backup only.", dbBackupResult.ErrorMessage);
                        // Create a note file indicating database backup failed
                        var noteFile = Path.Combine(dbBackupDir, "backup-note.txt");
                        await System.IO.File.WriteAllTextAsync(noteFile, 
                            $"Database backup failed: {dbBackupResult.ErrorMessage}\n" +
                            $"Date: {DateTime.Now}\n" +
                            $"Note: This backup contains only uploaded files. Database backup was not included.");
                    }
                    else
                    {
                        _logger.LogInformation("Database backup completed successfully");
                    }

                    // Step 2: Backup uploaded files
                    _logger.LogInformation("Backing up uploaded files...");
                    if (Directory.Exists(_uploadsDirectory))
                    {
                        CopyDirectory(_uploadsDirectory, uploadsBackupDir);
                    }
                    else
                    {
                        _logger.LogWarning("Uploads directory not found: {UploadsDirectory}", _uploadsDirectory);
                    }

                    // Step 3: Create ZIP file
                    _logger.LogInformation("Creating ZIP archive...");
                    
                    // Ensure backup directory exists
                    var backupDirInfo = new DirectoryInfo(_backupDirectory);
                    if (!backupDirInfo.Exists)
                    {
                        backupDirInfo.Create();
                        _logger.LogInformation("Created backup directory: {Dir}", _backupDirectory);
                    }
                    
                    ZipFile.CreateFromDirectory(tempBackupDir, backupFilePath);

                    var fileInfo = new FileInfo(backupFilePath);
                    if (!fileInfo.Exists)
                    {
                        _logger.LogError("ZIP file was not created: {Path}", backupFilePath);
                        return new BackupResult
                        {
                            Success = false,
                            ErrorMessage = "Failed to create ZIP archive"
                        };
                    }
                    
                    _logger.LogInformation("Backup created successfully: {BackupFile}, Size: {Size} bytes", backupFileName, fileInfo.Length);

                    return new BackupResult
                    {
                        Success = true,
                        FilePath = backupFilePath,
                        FileName = backupFileName,
                        FileSize = fileInfo.Length
                    };
                }
                finally
                {
                    // Clean up temporary directory
                    try
                    {
                        if (Directory.Exists(tempBackupDir))
                        {
                            Directory.Delete(tempBackupDir, true);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to clean up temporary backup directory: {TempDir}", tempBackupDir);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating backup: {Message}\n{StackTrace}", ex.Message, ex.StackTrace);
                return new BackupResult
                {
                    Success = false,
                    ErrorMessage = $"Error creating backup: {ex.Message}"
                };
            }
        }

        public async Task<RestoreResult> RestoreBackupAsync(string backupFilePath)
        {
            try
            {
                if (!File.Exists(backupFilePath))
                {
                    return new RestoreResult
                    {
                        Success = false,
                        ErrorMessage = "Backup file not found"
                    };
                }

                // Extract ZIP to temporary directory
                var tempExtractDir = Path.Combine(Path.GetTempPath(), $"restore-{Guid.NewGuid()}");
                Directory.CreateDirectory(tempExtractDir);

                try
                {
                    _logger.LogInformation("Extracting backup file...");
                    ZipFile.ExtractToDirectory(backupFilePath, tempExtractDir);

                    var dbBackupDir = Path.Combine(tempExtractDir, "database");
                    var uploadsBackupDir = Path.Combine(tempExtractDir, "uploads");

                    // Step 1: Restore database
                    if (Directory.Exists(dbBackupDir))
                    {
                        var dbBackupFile = Directory.GetFiles(dbBackupDir, "*.bak").FirstOrDefault();
                        var jsonMetadata = Path.Combine(dbBackupDir, "_backup_metadata.json");

                        if (dbBackupFile != null)
                        {
                            _logger.LogInformation("Restoring database from backup...");
                            var restoreResult = await RestoreDatabaseAsync(dbBackupFile);
                            if (!restoreResult.Success)
                            {
                                return new RestoreResult
                                {
                                    Success = false,
                                    ErrorMessage = $"Database restore failed: {restoreResult.ErrorMessage}"
                                };
                            }
                        }
                        else if (File.Exists(jsonMetadata))
                        {
                            _logger.LogInformation("Restoring database from JSON table export...");
                            var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
                                ?? _configuration.GetConnectionString("DefaultConnection");
                            if (string.IsNullOrEmpty(connectionString))
                            {
                                return new RestoreResult { Success = false, ErrorMessage = "Database connection string not found" };
                            }

                            var importResult = await ImportDatabaseFromJsonAsync(dbBackupDir, connectionString);
                            if (!importResult.Success)
                            {
                                return new RestoreResult
                                {
                                    Success = false,
                                    ErrorMessage = $"Database restore from JSON failed: {importResult.ErrorMessage}"
                                };
                            }
                        }
                        else
                        {
                            return new RestoreResult
                            {
                                Success = false,
                                ErrorMessage =
                                    "No database backup (.bak) found in the ZIP. Only uploaded files would be restored."
                            };
                        }
                    }
                    else
                    {
                        return new RestoreResult
                        {
                            Success = false,
                            ErrorMessage =
                                "Backup ZIP has no database folder. Cannot restore SQL data. " +
                                "Use a full backup created from Backup & Restore in the app."
                        };
                    }

                    // Step 2: Restore uploaded files
                    if (Directory.Exists(uploadsBackupDir))
                    {
                        _logger.LogInformation("Restoring uploaded files...");
                        
                        // Clear existing uploads
                        if (Directory.Exists(_uploadsDirectory))
                        {
                            Directory.Delete(_uploadsDirectory, true);
                        }
                        Directory.CreateDirectory(_uploadsDirectory);

                        // Copy backup files
                        CopyDirectory(uploadsBackupDir, _uploadsDirectory);
                    }

                    _logger.LogInformation("Backup restored successfully");
                    return new RestoreResult { Success = true };
                }
                finally
                {
                    // Clean up temporary directory
                    try
                    {
                        if (Directory.Exists(tempExtractDir))
                        {
                            Directory.Delete(tempExtractDir, true);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to clean up temporary restore directory: {TempDir}", tempExtractDir);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring backup");
                return new RestoreResult
                {
                    Success = false,
                    ErrorMessage = $"Error restoring backup: {ex.Message}"
                };
            }
        }

        public Task<List<BackupInfo>> ListBackupsAsync()
        {
            try
            {
                var backups = new List<BackupInfo>();

                if (!Directory.Exists(_backupDirectory))
                {
                    return Task.FromResult(backups);
                }

                var backupFiles = Directory.GetFiles(_backupDirectory, "invoiceapp-backup-*.zip")
                    .OrderByDescending(f => new FileInfo(f).CreationTime);

                foreach (var file in backupFiles)
                {
                    var fileInfo = new FileInfo(file);
                    backups.Add(new BackupInfo
                    {
                        FileName = fileInfo.Name,
                        FileSize = fileInfo.Length,
                        CreatedDate = fileInfo.CreationTime
                    });
                }

                return Task.FromResult(backups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing backups");
                return Task.FromResult(new List<BackupInfo>());
            }
        }

        private async Task<(bool Success, string? ErrorMessage)> BackupDatabaseAsync(string backupDir)
        {
            try
            {
                var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
                    ?? _configuration.GetConnectionString("DefaultConnection");

                if (string.IsNullOrEmpty(connectionString))
                {
                    return (false, "Database connection string not found");
                }

                // Parse connection string to get server and database info
                var builder = new SqlConnectionStringBuilder(connectionString);
                var database = builder.InitialCatalog ?? "InvoiceApp";

                // Detect environment: Docker/Linux vs Windows local
                var isDocker = File.Exists("/.dockerenv") || 
                               !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"));
                var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);

                // Strategy: Try BACKUP DATABASE to a path SQL Server can write to.
                // On Windows local: use SQL Server's own default backup directory (it always has write access there).
                // On Docker: use the shared volume.
                // After backup, copy the .bak file to our temp backupDir.

                string sqlBackupPath;
                var backupFileName = $"{database}_{DateTime.Now:yyyyMMdd_HHmmss}.bak";
                var localBackupPath = Path.Combine(backupDir, backupFileName);

                if (isWindows && !isDocker)
                {
                    // On Windows, query SQL Server for a path IT can write to
                    // Use SERVERPROPERTY which is available on SQL Server 2012+
                    string? defaultBackupDir = null;
                    try
                    {
                        using (var connection = new SqlConnection(connectionString))
                        {
                            await connection.OpenAsync();
                            using (var cmd = new SqlCommand(
                                "SELECT SERVERPROPERTY('InstanceDefaultBackupPath')", connection))
                            {
                                var result = await cmd.ExecuteScalarAsync();
                                defaultBackupDir = result?.ToString();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not query InstanceDefaultBackupPath");
                    }

                    // Fallback: query registry
                    if (string.IsNullOrEmpty(defaultBackupDir))
                    {
                        try
                        {
                            using (var connection = new SqlConnection(connectionString))
                            {
                                await connection.OpenAsync();
                                using (var cmd = new SqlCommand(
                                    "EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'BackupDirectory'",
                                    connection))
                                {
                                    using (var reader = await cmd.ExecuteReaderAsync())
                                    {
                                        if (await reader.ReadAsync() && !reader.IsDBNull(1))
                                        {
                                            defaultBackupDir = reader.GetString(1);
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not query backup directory from registry");
                        }
                    }

                    if (!string.IsNullOrEmpty(defaultBackupDir))
                    {
                        sqlBackupPath = Path.Combine(defaultBackupDir, backupFileName);
                    }
                    else
                    {
                        // Last resort: use the localBackupPath and hope SQL Server has access
                        sqlBackupPath = localBackupPath;
                    }

                    _logger.LogInformation("Windows environment. SQL Server backup path: {Path}", sqlBackupPath);
                }
                else
                {
                    // Docker/Linux environment - use shared volume path
                    sqlBackupPath = $"/var/opt/mssql/backup/{backupFileName}";
                    _logger.LogInformation("Docker/Linux environment. Backup path: {Path}", sqlBackupPath);
                }

                // Execute BACKUP DATABASE
                _logger.LogInformation("Starting database backup to: {Path}", sqlBackupPath);
                try
                {
                    using (var connection = new SqlConnection(connectionString))
                    {
                        await connection.OpenAsync();
                        
                        var escapedPath = sqlBackupPath.Replace("'", "''");
                        var backupSql = $@"
                            BACKUP DATABASE [{database}] 
                            TO DISK = N'{escapedPath}' 
                            WITH FORMAT, INIT, 
                            NAME = N'InvoiceApp Full Backup', 
                            SKIP, NOREWIND, NOUNLOAD, 
                            STATS = 10";

                        using (var command = new SqlCommand(backupSql, connection))
                        {
                            command.CommandTimeout = 300;
                            await command.ExecuteNonQueryAsync();
                        }
                        _logger.LogInformation("BACKUP DATABASE completed successfully");
                    }
                }
                catch (SqlException sqlEx)
                {
                    _logger.LogError(sqlEx, "BACKUP DATABASE failed. Error {Number}: {Message}", sqlEx.Number, sqlEx.Message);
                    
                    // If native backup fails, fall back to data export approach
                    _logger.LogInformation("Falling back to data export approach...");
                    return await ExportDatabaseAsJsonAsync(backupDir, connectionString, database);
                }

                // Now copy the .bak file to our local backup directory
                if (sqlBackupPath != localBackupPath)
                {
                    await Task.Delay(500); // Brief wait for filesystem

                    if (isWindows && !isDocker)
                    {
                        // Try to copy from SQL Server's backup directory
                        if (File.Exists(sqlBackupPath))
                        {
                            File.Copy(sqlBackupPath, localBackupPath, true);
                            _logger.LogInformation("Backup file copied from {Source} to {Dest}", sqlBackupPath, localBackupPath);
                            try { File.Delete(sqlBackupPath); } catch { }
                        }
                        else
                        {
                            _logger.LogWarning("Backup file not found at {Path}, falling back to data export", sqlBackupPath);
                            return await ExportDatabaseAsJsonAsync(backupDir, connectionString, database);
                        }
                    }
                    else
                    {
                        // Docker: try shared volume
                        var sharedBackupDir = "/app/wwwroot/backups/shared";
                        var sharedBackupPath = Path.Combine(sharedBackupDir, backupFileName);

                        if (!Directory.Exists(sharedBackupDir))
                            Directory.CreateDirectory(sharedBackupDir);

                        await Task.Delay(1000);

                        if (File.Exists(sharedBackupPath))
                        {
                            File.Copy(sharedBackupPath, localBackupPath, true);
                            _logger.LogInformation("Backup copied from shared volume");
                        }
                        else
                        {
                            _logger.LogWarning("Backup not found in shared volume, falling back to data export");
                            return await ExportDatabaseAsJsonAsync(backupDir, connectionString, database);
                        }
                    }
                }

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error backing up database");
                return (false, ex.Message);
            }
        }

        /// <summary>
        /// Fallback: Export all table data as JSON files (no SQL Server filesystem access needed).
        /// The app reads data via SQL connection and writes files itself.
        /// </summary>
        private async Task<(bool Success, string? ErrorMessage)> ExportDatabaseAsJsonAsync(
            string backupDir, string connectionString, string database)
        {
            try
            {
                _logger.LogInformation("Exporting database tables as JSON...");

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                // Get all user tables
                var tables = new List<string>();
                using (var cmd = new SqlCommand(
                    "SELECT SCHEMA_NAME(schema_id) + '.' + name FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY name",
                    connection))
                {
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        tables.Add(reader.GetString(0));
                    }
                }

                _logger.LogInformation("Found {Count} tables to export", tables.Count);

                foreach (var table in tables)
                {
                    try
                    {
                        var rows = new List<Dictionary<string, object?>>();
                        var schemaAndTable = table.Split('.');
                        var schema = schemaAndTable[0];
                        var tableName = schemaAndTable[1];
                        
                        using (var cmd = new SqlCommand($"SELECT * FROM [{schema}].[{tableName}]", connection))
                        {
                            cmd.CommandTimeout = 120;
                            using var reader = await cmd.ExecuteReaderAsync();
                            
                            while (await reader.ReadAsync())
                            {
                                var row = new Dictionary<string, object?>();
                                for (int i = 0; i < reader.FieldCount; i++)
                                {
                                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                                    // Convert byte arrays to base64 for JSON serialization
                                    if (value is byte[] bytes)
                                        value = Convert.ToBase64String(bytes);
                                    else if (value is DateTime dt)
                                        value = dt.ToString("O"); // ISO 8601
                                    else if (value is DateTimeOffset dto)
                                        value = dto.ToString("O");
                                    else if (value is TimeSpan ts)
                                        value = ts.ToString();
                                    row[reader.GetName(i)] = value;
                                }
                                rows.Add(row);
                            }
                        }

                        // Write table data as JSON
                        var safeTableName = table.Replace(".", "_").Replace("[", "").Replace("]", "");
                        var jsonFile = Path.Combine(backupDir, $"{safeTableName}.json");
                        var json = System.Text.Json.JsonSerializer.Serialize(rows, new System.Text.Json.JsonSerializerOptions 
                        { 
                            WriteIndented = true 
                        });
                        await File.WriteAllTextAsync(jsonFile, json);
                        
                        _logger.LogInformation("Exported {Table}: {Count} rows", table, rows.Count);
                    }
                    catch (Exception tableEx)
                    {
                        _logger.LogWarning(tableEx, "Failed to export table {Table}", table);
                    }
                }

                // Write metadata file
                var metadata = new Dictionary<string, object>
                {
                    ["exportDate"] = DateTime.Now.ToString("O"),
                    ["database"] = database,
                    ["exportType"] = "json_data_export",
                    ["tables"] = tables
                };
                var metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(Path.Combine(backupDir, "_backup_metadata.json"), metadataJson);

                _logger.LogInformation("Database export completed successfully ({Count} tables)", tables.Count);
                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting database as JSON");
                return (false, $"Database export failed: {ex.Message}");
            }
        }

        private async Task<(bool Success, string? ErrorMessage)> RestoreDatabaseAsync(string backupFilePath)
        {
            try
            {
                var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
                    ?? _configuration.GetConnectionString("DefaultConnection");

                if (string.IsNullOrEmpty(connectionString))
                {
                    return (false, "Database connection string not found");
                }

                var builder = new SqlConnectionStringBuilder(connectionString);
                var database = builder.InitialCatalog ?? "InvoiceApp";

                // Connect to master — required when InvoiceApp was deleted
                var masterBuilder = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = "master" };

                var isDocker = File.Exists("/.dockerenv") ||
                               !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"));
                var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);

                var sqlRestorePath = await ResolveSqlServerRestorePathAsync(
                    backupFilePath, masterBuilder.ConnectionString, isWindows && !isDocker, isDocker);

                using (var connection = new SqlConnection(masterBuilder.ConnectionString))
                {
                    await connection.OpenAsync();

                    var dbExists = await DatabaseExistsAsync(connection, database);
                    _logger.LogInformation(
                        "Restoring database {Database} (exists={Exists}) from {Path}",
                        database, dbExists, sqlRestorePath);

                    if (dbExists)
                    {
                        var setSingleUserSql = $"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE";
                        using (var command = new SqlCommand(setSingleUserSql, connection))
                        {
                            await command.ExecuteNonQueryAsync();
                        }
                    }

                    try
                    {
                        var escapedPath = sqlRestorePath.Replace("'", "''");
                        var restoreSql = $@"
                            RESTORE DATABASE [{database}]
                            FROM DISK = N'{escapedPath}'
                            WITH REPLACE,
                            STATS = 10";

                        using (var command = new SqlCommand(restoreSql, connection))
                        {
                            command.CommandTimeout = 600;
                            await command.ExecuteNonQueryAsync();
                        }
                    }
                    finally
                    {
                        if (dbExists)
                        {
                            try
                            {
                                var setMultiUserSql = $"ALTER DATABASE [{database}] SET MULTI_USER";
                                using (var command = new SqlCommand(setMultiUserSql, connection))
                                {
                                    await command.ExecuteNonQueryAsync();
                                }
                            }
                            catch (Exception multiUserEx)
                            {
                                _logger.LogWarning(multiUserEx, "Could not set database back to MULTI_USER");
                            }
                        }
                    }
                }

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring database");
                return (false, ex.Message);
            }
        }

        private static async Task<bool> DatabaseExistsAsync(SqlConnection connection, string database)
        {
            const string sql = "SELECT COUNT(*) FROM sys.databases WHERE name = @name";
            using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@name", database);
            var result = await command.ExecuteScalarAsync();
            return result != null && Convert.ToInt32(result) > 0;
        }

        private async Task<string> ResolveSqlServerRestorePathAsync(
            string localBackupFilePath,
            string masterConnectionString,
            bool isWindowsLocal,
            bool isDocker)
        {
            if (!File.Exists(localBackupFilePath))
            {
                throw new FileNotFoundException("Backup file not found", localBackupFilePath);
            }

            var fileName = Path.GetFileName(localBackupFilePath);

            if (isDocker)
            {
                var sharedBackupDir = "/app/wwwroot/backups/shared";
                if (!Directory.Exists(sharedBackupDir))
                {
                    Directory.CreateDirectory(sharedBackupDir);
                }

                var sharedBackupPath = Path.Combine(sharedBackupDir, fileName);
                File.Copy(localBackupFilePath, sharedBackupPath, true);
                return $"/var/opt/mssql/backup/{fileName}";
            }

            if (isWindowsLocal)
            {
                string? defaultBackupDir = null;
                try
                {
                    using var connection = new SqlConnection(masterConnectionString);
                    await connection.OpenAsync();
                    using var cmd = new SqlCommand("SELECT SERVERPROPERTY('InstanceDefaultBackupPath')", connection);
                    var result = await cmd.ExecuteScalarAsync();
                    defaultBackupDir = result?.ToString();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not query InstanceDefaultBackupPath for restore");
                }

                if (!string.IsNullOrWhiteSpace(defaultBackupDir))
                {
                    var targetPath = Path.Combine(defaultBackupDir, fileName);
                    File.Copy(localBackupFilePath, targetPath, true);
                    _logger.LogInformation("Copied backup for restore to {Path}", targetPath);
                    return targetPath;
                }
            }

            return localBackupFilePath;
        }

        private async Task<(bool Success, string? ErrorMessage)> ImportDatabaseFromJsonAsync(
            string dbBackupDir, string connectionString)
        {
            try
            {
                var builder = new SqlConnectionStringBuilder(connectionString);
                var database = builder.InitialCatalog ?? "InvoiceApp";
                var masterConnectionString = new SqlConnectionStringBuilder(connectionString)
                {
                    InitialCatalog = "master"
                }.ConnectionString;

                await EnsureDatabaseExistsAsync(masterConnectionString, database);
                await _dbContext.Database.MigrateAsync();

                builder.InitialCatalog = database;
                using var connection = new SqlConnection(builder.ConnectionString);
                await connection.OpenAsync();

                _logger.LogInformation("Clearing existing data before JSON import...");
                await ExecuteNonQueryAsync(connection, @"
                    DECLARE @sql NVARCHAR(MAX) = N'';
                    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N' NOCHECK CONSTRAINT ALL;'
                    FROM sys.tables WHERE is_ms_shipped = 0;
                    EXEC sp_executesql @sql;");

                await ExecuteNonQueryAsync(connection, @"
                    DECLARE @sql NVARCHAR(MAX) = N'';
                    SELECT @sql += N'DELETE FROM ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
                    FROM sys.tables WHERE is_ms_shipped = 0;
                    EXEC sp_executesql @sql;");

                var jsonFiles = Directory
                    .GetFiles(dbBackupDir, "*.json")
                    .Where(f => !string.Equals(Path.GetFileName(f), "_backup_metadata.json", StringComparison.OrdinalIgnoreCase))
                    .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                _logger.LogInformation("Importing {Count} table JSON files...", jsonFiles.Count);

                foreach (var jsonFile in jsonFiles)
                {
                    if (!TryParseTableFromJsonFileName(Path.GetFileNameWithoutExtension(jsonFile), out var schema, out var tableName))
                    {
                        _logger.LogWarning("Skipping unrecognized JSON file: {File}", jsonFile);
                        continue;
                    }

                    await ImportTableFromJsonAsync(connection, schema, tableName, jsonFile);
                }

                await ExecuteNonQueryAsync(connection, @"
                    DECLARE @sql NVARCHAR(MAX) = N'';
                    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N' WITH CHECK CHECK CONSTRAINT ALL;'
                    FROM sys.tables WHERE is_ms_shipped = 0;
                    EXEC sp_executesql @sql;");

                _logger.LogInformation("JSON database import completed");
                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing database from JSON");
                return (false, ex.Message);
            }
        }

        private async Task EnsureDatabaseExistsAsync(string masterConnectionString, string database)
        {
            using var connection = new SqlConnection(masterConnectionString);
            await connection.OpenAsync();

            if (await DatabaseExistsAsync(connection, database))
            {
                return;
            }

            _logger.LogInformation("Creating database {Database} for JSON restore...", database);
            using var createCmd = new SqlCommand($"CREATE DATABASE [{database}]", connection);
            await createCmd.ExecuteNonQueryAsync();
        }

        private static bool TryParseTableFromJsonFileName(string fileName, out string schema, out string tableName)
        {
            schema = "dbo";
            tableName = fileName;
            var underscore = fileName.IndexOf('_');
            if (underscore <= 0 || underscore >= fileName.Length - 1)
            {
                return false;
            }

            schema = fileName[..underscore];
            tableName = fileName[(underscore + 1)..];
            return true;
        }

        private async Task ImportTableFromJsonAsync(
            SqlConnection connection, string schema, string tableName, string jsonFilePath)
        {
            var json = await File.ReadAllTextAsync(jsonFilePath);
            var rows = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);
            if (rows == null || rows.Count == 0)
            {
                _logger.LogInformation("Skipping empty table {Schema}.{Table}", schema, tableName);
                return;
            }

            var columns = rows[0].Keys.ToList();
            var columnList = string.Join(", ", columns.Select(c => $"[{c}]"));
            var hasIdentity = await TableHasIdentityAsync(connection, schema, tableName);

            if (hasIdentity)
            {
                await ExecuteNonQueryAsync(connection,
                    $"SET IDENTITY_INSERT [{schema}].[{tableName}] ON");
            }

            var inserted = 0;
            foreach (var row in rows)
            {
                var parameters = new List<SqlParameter>();
                var paramNames = new List<string>();
                for (var i = 0; i < columns.Count; i++)
                {
                    var paramName = $"@p{i}";
                    paramNames.Add(paramName);
                    row.TryGetValue(columns[i], out var element);
                    parameters.Add(new SqlParameter(paramName, ConvertJsonElement(element) ?? DBNull.Value));
                }

                var insertSql =
                    $"INSERT INTO [{schema}].[{tableName}] ({columnList}) VALUES ({string.Join(", ", paramNames)})";
                using var cmd = new SqlCommand(insertSql, connection);
                cmd.CommandTimeout = 120;
                cmd.Parameters.AddRange(parameters.ToArray());
                await cmd.ExecuteNonQueryAsync();
                inserted++;
            }

            if (hasIdentity)
            {
                await ExecuteNonQueryAsync(connection,
                    $"SET IDENTITY_INSERT [{schema}].[{tableName}] OFF");
            }

            _logger.LogInformation("Imported {Schema}.{Table}: {Count} rows", schema, tableName, inserted);
        }

        private static async Task<bool> TableHasIdentityAsync(SqlConnection connection, string schema, string tableName)
        {
            const string sql = @"
                SELECT CASE WHEN EXISTS (
                    SELECT 1 FROM sys.columns c
                    INNER JOIN sys.tables t ON c.object_id = t.object_id
                    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
                    WHERE s.name = @schema AND t.name = @table AND c.is_identity = 1
                ) THEN 1 ELSE 0 END";
            using var cmd = new SqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("@schema", schema);
            cmd.Parameters.AddWithValue("@table", tableName);
            var result = await cmd.ExecuteScalarAsync();
            return result != null && Convert.ToInt32(result) == 1;
        }

        private static object? ConvertJsonElement(JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Undefined)
            {
                return DBNull.Value;
            }

            return element.ValueKind switch
            {
                JsonValueKind.Null => DBNull.Value,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number when element.TryGetInt64(out var longVal) => longVal,
                JsonValueKind.Number => element.GetDecimal(),
                JsonValueKind.String => element.GetString(),
                _ => element.GetRawText()
            };
        }

        private static async Task ExecuteNonQueryAsync(SqlConnection connection, string sql)
        {
            using var cmd = new SqlCommand(sql, connection);
            cmd.CommandTimeout = 300;
            await cmd.ExecuteNonQueryAsync();
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            if (!Directory.Exists(sourceDir))
                return;

            if (!Directory.Exists(destDir))
            {
                Directory.CreateDirectory(destDir);
            }

            var files = Directory.GetFiles(sourceDir);
            foreach (var file in files)
            {
                var fileName = Path.GetFileName(file);
                var destFile = Path.Combine(destDir, fileName);
                File.Copy(file, destFile, true);
            }

            var dirs = Directory.GetDirectories(sourceDir);
            foreach (var dir in dirs)
            {
                var dirName = Path.GetFileName(dir);
                var destSubDir = Path.Combine(destDir, dirName);
                CopyDirectory(dir, destSubDir);
            }
        }
    }
}
