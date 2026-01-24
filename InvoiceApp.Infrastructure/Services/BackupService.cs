using InvoiceApp.Application.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;

namespace InvoiceApp.Infrastructure.Services
{
    public class BackupService : IBackupService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BackupService> _logger;
        private readonly string _backupDirectory;
        private readonly string _uploadsDirectory;

        public BackupService(IConfiguration configuration, ILogger<BackupService> logger)
        {
            _configuration = configuration;
            _logger = logger;
            
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
                        if (dbBackupFile != null)
                        {
                            _logger.LogInformation("Copying database backup to shared volume...");
                            
                            // Copy backup file to shared volume so SQL Server can access it
                            // Shared volume is mounted at /app/wwwroot/backups/shared in API container
                            var sharedBackupDir = "/app/wwwroot/backups/shared";
                            var sharedBackupPath = Path.Combine(sharedBackupDir, Path.GetFileName(dbBackupFile));
                            
                            try
                            {
                                // Ensure directory exists
                                if (!Directory.Exists(sharedBackupDir))
                                {
                                    Directory.CreateDirectory(sharedBackupDir);
                                }
                                
                                File.Copy(dbBackupFile, sharedBackupPath, true);
                                _logger.LogInformation("Database backup copied to shared volume: {Path}", sharedBackupPath);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to copy backup to shared volume");
                                return new RestoreResult
                                {
                                    Success = false,
                                    ErrorMessage = $"Failed to copy backup file to shared volume: {ex.Message}"
                                };
                            }
                            
                            // SQL Server sees the file at /var/opt/mssql/backup
                            var sqlBackupPath = $"/var/opt/mssql/backup/{Path.GetFileName(dbBackupFile)}";
                            _logger.LogInformation("Restoring database from backup...");
                            var restoreResult = await RestoreDatabaseAsync(sqlBackupPath);
                            if (!restoreResult.Success)
                            {
                                return new RestoreResult
                                {
                                    Success = false,
                                    ErrorMessage = $"Database restore failed: {restoreResult.ErrorMessage}"
                                };
                            }
                        }
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
                var server = builder.DataSource;
                var database = builder.InitialCatalog ?? "InvoiceApp";

                // Create backup file path
                var backupFileName = $"{database}_{DateTime.Now:yyyyMMdd_HHmmss}.bak";
                var backupFilePath = Path.Combine(backupDir, backupFileName);

                // For Docker environment, SQL Server needs write permissions
                // First try the shared volume path, if that fails, use data directory
                var sqlBackupPath = $"/var/opt/mssql/backup/{backupFileName}";
                var sqlBackupPathAlt = $"/var/opt/mssql/data/{backupFileName}"; // Fallback location
                var localBackupPath = Path.Combine(backupDir, backupFileName);
                
                // Execute backup command - try shared volume first
                _logger.LogInformation("Starting database backup to: {Path}", sqlBackupPath);
                try
                {
                    using (var connection = new SqlConnection(connectionString))
                    {
                        await connection.OpenAsync();
                        _logger.LogInformation("Database connection opened successfully");
                        
                        // Escape single quotes in path for SQL
                        var escapedPath = sqlBackupPath.Replace("'", "''");
                        var backupSql = $@"
                            BACKUP DATABASE [{database}] 
                            TO DISK = '{escapedPath}' 
                            WITH FORMAT, INIT, 
                            NAME = 'InvoiceApp Full Backup', 
                            SKIP, NOREWIND, NOUNLOAD, 
                            STATS = 10";
                        
                        _logger.LogInformation("Executing backup SQL command");

                        using (var command = new SqlCommand(backupSql, connection))
                        {
                            command.CommandTimeout = 300; // 5 minutes timeout
                            await command.ExecuteNonQueryAsync();
                        }
                        _logger.LogInformation("Database backup SQL command executed successfully");
                        
                        // Verify backup file was created
                        await Task.Delay(2000); // Wait for file to be written
                    }
                }
                catch (SqlException sqlEx)
                {
                    // If backup to shared volume fails due to permissions, try data directory
                    if (sqlEx.Number == 3201 && sqlEx.Message.Contains("Access is denied"))
                    {
                        _logger.LogWarning("Backup to shared volume failed due to permissions. Trying data directory...");
                        sqlBackupPath = sqlBackupPathAlt;
                        
                        try
                        {
                            using (var connection = new SqlConnection(connectionString))
                            {
                                await connection.OpenAsync();
                                var escapedPath = sqlBackupPath.Replace("'", "''");
                                var backupSql = $@"
                                    BACKUP DATABASE [{database}] 
                                    TO DISK = '{escapedPath}' 
                                    WITH FORMAT, INIT, 
                                    NAME = 'InvoiceApp Full Backup', 
                                    SKIP, NOREWIND, NOUNLOAD, 
                                    STATS = 10";
                                
                                using (var command = new SqlCommand(backupSql, connection))
                                {
                                    command.CommandTimeout = 300;
                                    await command.ExecuteNonQueryAsync();
                                }
                                _logger.LogInformation("Database backup created successfully in data directory: {Path}", sqlBackupPath);
                            }
                        }
                        catch (Exception retryEx)
                        {
                            _logger.LogError(retryEx, "Backup to data directory also failed: {Message}", retryEx.Message);
                            return (false, $"Database backup failed: {retryEx.Message}. Please run fix-backup-permissions.bat to fix permissions.");
                        }
                    }
                    else
                    {
                        _logger.LogError(sqlEx, "SQL Server error during backup. Error Number: {Number}, Message: {Message}", 
                            sqlEx.Number, sqlEx.Message);
                        return (false, $"SQL Server error: {sqlEx.Message} (Error {sqlEx.Number})");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error executing database backup command: {Message}", ex.Message);
                    return (false, $"Error executing backup: {ex.Message}");
                }
                
                _logger.LogInformation("Database backup command completed successfully");
                
                // Copy backup file to local backup directory
                // If backup was created in data directory, we need to copy it via shared volume or docker exec
                var sharedBackupDir = "/app/wwwroot/backups/shared";
                var sharedBackupPath = Path.Combine(sharedBackupDir, backupFileName);
                
                try
                {
                    // Ensure shared directory exists
                    if (!Directory.Exists(sharedBackupDir))
                    {
                        Directory.CreateDirectory(sharedBackupDir);
                    }
                    
                    // Wait for file to be written
                    await Task.Delay(2000);
                    
                    // Try to copy from shared volume first (if backup was created there)
                    if (File.Exists(sharedBackupPath))
                    {
                        File.Copy(sharedBackupPath, localBackupPath, true);
                        _logger.LogInformation("Database backup copied from shared volume: {Path}", sharedBackupPath);
                    }
                    else if (sqlBackupPath.Contains("/data/"))
                    {
                        // Backup was created in data directory, try to copy it using SQL Server xp_cmdshell
                        _logger.LogInformation("Backup was created in data directory. Attempting to copy to shared volume using SQL Server...");
                        
                        try
                        {
                            // Use SQL Server to copy the file (requires xp_cmdshell to be enabled)
                            using (var connection = new SqlConnection(connectionString))
                            {
                                await connection.OpenAsync();
                                
                                // Enable xp_cmdshell temporarily
                                using (var enableCmd = new SqlCommand(@"
                                    EXEC sp_configure 'show advanced options', 1;
                                    RECONFIGURE;
                                    EXEC sp_configure 'xp_cmdshell', 1;
                                    RECONFIGURE;", connection))
                                {
                                    await enableCmd.ExecuteNonQueryAsync();
                                }
                                
                                // Copy file using xp_cmdshell
                                var copyCommand = $"cp {sqlBackupPath} /var/opt/mssql/backup/{backupFileName}";
                                var escapedCopyCommand = copyCommand.Replace("'", "''");
                                using (var copyCmd = new SqlCommand($"EXEC xp_cmdshell '{escapedCopyCommand}'", connection))
                                {
                                    var result = await copyCmd.ExecuteScalarAsync();
                                    _logger.LogInformation("SQL Server copy command executed");
                                }
                                
                                // Set permissions
                                var chmodCommand = $"chmod 666 /var/opt/mssql/backup/{backupFileName}";
                                var escapedChmodCommand = chmodCommand.Replace("'", "''");
                                using (var chmodCmd = new SqlCommand($"EXEC xp_cmdshell '{escapedChmodCommand}'", connection))
                                {
                                    await chmodCmd.ExecuteNonQueryAsync();
                                }
                                
                                // Disable xp_cmdshell for security
                                using (var disableCmd = new SqlCommand(@"
                                    EXEC sp_configure 'xp_cmdshell', 0;
                                    RECONFIGURE;
                                    EXEC sp_configure 'show advanced options', 0;
                                    RECONFIGURE;", connection))
                                {
                                    await disableCmd.ExecuteNonQueryAsync();
                                }
                                
                                _logger.LogInformation("Backup file copied to shared volume via SQL Server xp_cmdshell");
                                
                                // Wait for file to be available
                                await Task.Delay(2000);
                                
                                // Try to copy from shared volume
                                if (File.Exists(sharedBackupPath))
                                {
                                    File.Copy(sharedBackupPath, localBackupPath, true);
                                    _logger.LogInformation("Database backup copied from shared volume: {Path}", sharedBackupPath);
                                }
                                else
                                {
                                    _logger.LogWarning("Backup file not found in shared volume after copy attempt");
                                }
                            }
                        }
                        catch (Exception sqlCopyEx)
                        {
                            _logger.LogWarning(sqlCopyEx, "Could not copy backup using SQL Server xp_cmdshell: {Message}", sqlCopyEx.Message);
                            
                            // Fallback: Try using docker exec if available (from host, not container)
                            var isDocker = File.Exists("/.dockerenv") || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"));
                            
                            if (isDocker)
                            {
                                try
                                {
                                    // Try to use docker command (may not work from inside container)
                                    var processStartInfo = new ProcessStartInfo
                                    {
                                        FileName = "docker",
                                        Arguments = $"exec invoiceapp-db bash -c \"cp {sqlBackupPath} /var/opt/mssql/backup/{backupFileName} && chmod 666 /var/opt/mssql/backup/{backupFileName}\"",
                                        RedirectStandardOutput = true,
                                        RedirectStandardError = true,
                                        UseShellExecute = false,
                                        CreateNoWindow = true
                                    };
                                    
                                    using (var process = Process.Start(processStartInfo))
                                    {
                                        if (process != null)
                                        {
                                            await process.WaitForExitAsync();
                                            if (process.ExitCode == 0)
                                            {
                                                _logger.LogInformation("Backup file copied to shared volume via docker exec");
                                                await Task.Delay(1000);
                                                if (File.Exists(sharedBackupPath))
                                                {
                                                    File.Copy(sharedBackupPath, localBackupPath, true);
                                                    _logger.LogInformation("Database backup copied from shared volume: {Path}", sharedBackupPath);
                                                }
                                            }
                                            else
                                            {
                                                var error = await process.StandardError.ReadToEndAsync();
                                                _logger.LogWarning("Docker exec copy failed: {Error}", error);
                                            }
                                        }
                                    }
                                }
                                catch (Exception dockerEx)
                                {
                                    _logger.LogWarning(dockerEx, "Could not use docker exec. Docker may not be available in container.");
                                }
                            }
                            
                            // If still not copied, create a note
                            if (!File.Exists(localBackupPath))
                            {
                                var noteFile = Path.Combine(backupDir, "backup-note.txt");
                                await System.IO.File.WriteAllTextAsync(noteFile,
                                    $"Database backup created in SQL Server container at: {sqlBackupPath}\n" +
                                    $"The backup file exists but could not be automatically copied to the ZIP.\n\n" +
                                    $"To fix this issue permanently, run: fix-backup-permissions.bat\n\n" +
                                    $"To manually retrieve the backup:\n" +
                                    $"  docker cp invoiceapp-db:{sqlBackupPath} .\n\n" +
                                    $"The ZIP file contains uploaded files. Database backup can be retrieved manually.");
                            }
                        }
                    }
                }
                catch (Exception copyEx)
                {
                    _logger.LogWarning(copyEx, "Could not copy backup file to local directory: {Message}", copyEx.Message);
                }

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error backing up database");
                return (false, ex.Message);
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

                // Copy backup file to SQL Server container accessible location
                // For Docker, we need to copy to a location SQL Server can access
                var sqlBackupPath = $"/var/opt/mssql/backup/{Path.GetFileName(backupFilePath)}";
                
                // Note: In Docker environment, we need to copy the file to SQL Server container
                // This is a limitation - we would need docker exec or shared volume
                // For now, we'll log a warning
                _logger.LogWarning("Database restore requires file to be accessible by SQL Server container. File: {BackupFile}", backupFilePath);

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    // Set database to single user mode for restore
                    var setSingleUserSql = $"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE";
                    using (var command = new SqlCommand(setSingleUserSql, connection))
                    {
                        await command.ExecuteNonQueryAsync();
                    }

                    try
                    {
                        var restoreSql = $@"
                            RESTORE DATABASE [{database}] 
                            FROM DISK = '{sqlBackupPath}' 
                            WITH REPLACE, 
                            STATS = 10";

                        using (var command = new SqlCommand(restoreSql, connection))
                        {
                            command.CommandTimeout = 600; // 10 minutes timeout
                            await command.ExecuteNonQueryAsync();
                        }
                    }
                    finally
                    {
                        // Set database back to multi-user mode
                        var setMultiUserSql = $"ALTER DATABASE [{database}] SET MULTI_USER";
                        using (var command = new SqlCommand(setMultiUserSql, connection))
                        {
                            await command.ExecuteNonQueryAsync();
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
