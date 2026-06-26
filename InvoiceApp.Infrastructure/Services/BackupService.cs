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
                    // Step 1: Backup database (.bak + optional JSON fallback for cross-version Docker restore)
                    _logger.LogInformation("Creating database backup...");
                    var dbBackupResult = await BackupDatabaseAsync(dbBackupDir);
                    var bakPath = Path.Combine(dbBackupDir, BackupFileName);
                    if (!dbBackupResult.Success || !File.Exists(bakPath))
                    {
                        return new BackupResult
                        {
                            Success = false,
                            ErrorMessage = dbBackupResult.ErrorMessage
                                ?? "SQL Server backup file (InvoiceApp.bak) was not created."
                        };
                    }

                    _logger.LogInformation(
                        "Database backup completed: {Path} ({Size} bytes)",
                        bakPath,
                        new FileInfo(bakPath).Length);

                    var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
                        ?? _configuration.GetConnectionString("DefaultConnection");
                    if (!string.IsNullOrEmpty(connectionString))
                    {
                        var jsonFallbackDir = Path.Combine(dbBackupDir, "json-fallback");
                        Directory.CreateDirectory(jsonFallbackDir);
                        try
                        {
                            var builder = new SqlConnectionStringBuilder(connectionString);
                            var database = builder.InitialCatalog ?? "InvoiceApp";
                            await ExportDatabaseAsJsonAsync(jsonFallbackDir, connectionString, database);
                            _logger.LogInformation(
                                "JSON fallback export saved to json-fallback/ for Docker SQL 2022 restore");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex,
                                "JSON fallback export failed; InvoiceApp.bak backup is still valid");
                        }
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
                            _logger.LogInformation("Restoring database from .bak backup...");
                            var restoreResult = await RestoreDatabaseAsync(dbBackupFile);
                            if (!restoreResult.Success)
                            {
                                var jsonImportDir = FindJsonExportDirectory(dbBackupDir);
                                if (IsSqlVersionMismatchMessage(restoreResult.ErrorMessage) && jsonImportDir != null)
                                {
                                    _logger.LogWarning(
                                        ".bak restore failed (SQL version mismatch); importing from {JsonDir}...",
                                        jsonImportDir);

                                    var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
                                        ?? _configuration.GetConnectionString("DefaultConnection");
                                    if (string.IsNullOrEmpty(connectionString))
                                    {
                                        return new RestoreResult
                                        {
                                            Success = false,
                                            ErrorMessage = "Database connection string not found"
                                        };
                                    }

                                    var importResult = await ImportDatabaseFromJsonAsync(
                                        jsonImportDir, connectionString);
                                    if (!importResult.Success)
                                    {
                                        return new RestoreResult
                                        {
                                            Success = false,
                                            ErrorMessage =
                                                $"Database restore from JSON fallback failed: {importResult.ErrorMessage}"
                                        };
                                    }
                                }
                                else if (IsSqlVersionMismatchMessage(restoreResult.ErrorMessage))
                                {
                                    return new RestoreResult
                                    {
                                        Success = false,
                                        ErrorMessage =
                                            "Database restore failed: your backup was created on SQL Server 2025 (local PC) " +
                                            "but Docker uses SQL Server 2022. This ZIP has no JSON fallback data. " +
                                            "Create a new backup from the local app (run API in Visual Studio with the latest code), " +
                                            "then upload and restore that new ZIP in Docker."
                                    };
                                }
                                else
                                {
                                    return new RestoreResult
                                    {
                                        Success = false,
                                        ErrorMessage = $"Database restore failed: {restoreResult.ErrorMessage}"
                                    };
                                }
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

                        // Docker mounts wwwroot/uploads as a volume — delete contents only, not the mount point
                        EnsureDirectoryExists(_uploadsDirectory);
                        ClearDirectoryContents(_uploadsDirectory);
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

        public Task<BackupResult?> GetBackupFileAsync(string fileName)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(fileName) || !IsValidBackupFileName(fileName))
                {
                    return Task.FromResult<BackupResult?>(null);
                }

                var filePath = Path.Combine(_backupDirectory, fileName);
                if (!File.Exists(filePath))
                {
                    return Task.FromResult<BackupResult?>(null);
                }

                var fileInfo = new FileInfo(filePath);
                return Task.FromResult<BackupResult?>(new BackupResult
                {
                    Success = true,
                    FilePath = filePath,
                    FileName = fileInfo.Name,
                    FileSize = fileInfo.Length
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting backup file: {FileName}", fileName);
                return Task.FromResult<BackupResult?>(null);
            }
        }

        private static bool IsValidBackupFileName(string fileName)
        {
            if (fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                return false;
            if (fileName.Contains("..", StringComparison.Ordinal))
                return false;
            return fileName.StartsWith("invoiceapp-backup-", StringComparison.OrdinalIgnoreCase)
                && fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase);
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

        public async Task<BackupStatus> GetBackupStatusAsync()
        {
            const int staleAfterDays = 7;
            var backups = await ListBackupsAsync();
            var latest = backups.FirstOrDefault();

            if (latest == null || string.IsNullOrEmpty(latest.FileName))
            {
                return new BackupStatus
                {
                    HasBackup = false,
                    TotalBackups = 0,
                    StaleAfterDays = staleAfterDays,
                    IsStale = true,
                };
            }

            var daysSinceBackup = Math.Max(0, (int)Math.Floor((DateTime.Now - latest.CreatedDate).TotalDays));

            return new BackupStatus
            {
                HasBackup = true,
                LastBackupAt = latest.CreatedDate,
                LastBackupFileName = latest.FileName,
                LastBackupSize = latest.FileSize,
                TotalBackups = backups.Count,
                DaysSinceBackup = daysSinceBackup,
                StaleAfterDays = staleAfterDays,
                IsStale = daysSinceBackup >= staleAfterDays,
            };
        }

        private const string BackupFileName = "InvoiceApp.bak";

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

                var builder = new SqlConnectionStringBuilder(connectionString);
                var database = builder.InitialCatalog ?? "InvoiceApp";
                var localBakPath = Path.Combine(backupDir, BackupFileName);

                if (File.Exists(localBakPath))
                {
                    File.Delete(localBakPath);
                }

                var apiInDocker = File.Exists("/.dockerenv")
                    || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"));
                var sqlInDocker = IsSqlServerInDocker(builder);

                _logger.LogInformation(
                    "Backup environment: ApiInDocker={ApiInDocker}, SqlInDocker={SqlInDocker}, Database={Database}",
                    apiInDocker, sqlInDocker, database);

                if (apiInDocker)
                {
                    return await BackupDatabaseFromDockerApiAsync(
                        connectionString, database, localBakPath);
                }

                if (sqlInDocker)
                {
                    return await BackupDatabaseFromWindowsApiToDockerSqlAsync(
                        connectionString, database, localBakPath);
                }

                return await BackupDatabaseFromWindowsLocalSqlAsync(
                    connectionString, database, localBakPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error backing up database");
                return (false, $"Database backup failed: {ex.Message}");
            }
        }

        private static bool IsSqlServerInDocker(SqlConnectionStringBuilder builder)
        {
            var dataSource = (builder.DataSource ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(dataSource))
            {
                return false;
            }

            var normalized = dataSource.ToLowerInvariant();
            if (normalized.Equals("sqlserver", StringComparison.Ordinal))
            {
                return true;
            }

            return normalized.Contains(",1434")
                || normalized.Contains(":1434")
                || normalized.Contains("localhost,1434")
                || normalized.Contains("127.0.0.1,1434");
        }

        private async Task<(bool Success, string? ErrorMessage)> BackupDatabaseFromDockerApiAsync(
            string connectionString,
            string database,
            string localBakPath)
        {
            var sqlDiskPath = $"/var/opt/mssql/backup/{BackupFileName}";
            var sharedPath = $"/app/wwwroot/backups/shared/{BackupFileName}";
            var dockerSqlPaths = new[] { sqlDiskPath, $"/var/opt/mssql/data/{BackupFileName}" };

            foreach (var path in dockerSqlPaths)
            {
                try
                {
                    await ExecuteBackupDatabaseAsync(connectionString, database, path);
                }
                catch (SqlException ex)
                {
                    _logger.LogWarning(ex, "BACKUP DATABASE failed for path {Path}", path);
                    continue;
                }

                if (await WaitForFileAsync(sharedPath))
                {
                    File.Copy(sharedPath, localBakPath, true);
                    _logger.LogInformation("Copied backup from shared volume to {Path}", localBakPath);
                    return (true, null);
                }

                if (await WaitForFileAsync(path))
                {
                    File.Copy(path, localBakPath, true);
                    _logger.LogInformation("Copied backup from {Path} to {Path}", path, localBakPath);
                    return (true, null);
                }
            }

            return (false,
                "SQL Server backup completed but InvoiceApp.bak was not found on the shared volume. " +
                "Run fix-backup-permissions.bat and try again.");
        }

        private async Task<(bool Success, string? ErrorMessage)> BackupDatabaseFromWindowsApiToDockerSqlAsync(
            string connectionString,
            string database,
            string localBakPath)
        {
            var containerName = Environment.GetEnvironmentVariable("BACKUP_SQL_CONTAINER_NAME") ?? "invoiceapp-db";
            var dockerSqlPaths = new[]
            {
                $"/var/opt/mssql/backup/{BackupFileName}",
                $"/var/opt/mssql/data/{BackupFileName}"
            };

            SqlException? lastError = null;
            foreach (var sqlDiskPath in dockerSqlPaths)
            {
                try
                {
                    await ExecuteBackupDatabaseAsync(connectionString, database, sqlDiskPath);
                }
                catch (SqlException ex)
                {
                    lastError = ex;
                    _logger.LogWarning(ex, "BACKUP DATABASE failed for Docker SQL path {Path}", sqlDiskPath);
                    continue;
                }

                if (TryDockerCopyFromContainer(containerName, sqlDiskPath, localBakPath))
                {
                    _logger.LogInformation(
                        "Copied backup from container {Container}:{Path} to {LocalPath}",
                        containerName, sqlDiskPath, localBakPath);
                    return (true, null);
                }
            }

            var detail = lastError != null
                ? $" SQL error: {lastError.Message}"
                : string.Empty;

            return (false,
                $"Could not copy InvoiceApp.bak from Docker container '{containerName}'.{detail} " +
                "Ensure Docker is running and the SQL container is named invoiceapp-db (or set BACKUP_SQL_CONTAINER_NAME).");
        }

        private async Task<(bool Success, string? ErrorMessage)> BackupDatabaseFromWindowsLocalSqlAsync(
            string connectionString,
            string database,
            string localBakPath)
        {
            // SQL Server cannot write to user Temp; default Backup folder is often not readable by the API process.
            // Stage the .bak under wwwroot/backups/shared and grant the SQL service account write access.
            var stagingDir = Path.Combine(_backupDirectory, "shared");
            Directory.CreateDirectory(stagingDir);
            await EnsureWindowsSqlBackupDirectoryAsync(connectionString, stagingDir);

            var stagingPath = Path.Combine(stagingDir, BackupFileName);
            TryDeleteFile(stagingPath);

            try
            {
                await ExecuteBackupDatabaseAsync(connectionString, database, stagingPath);
            }
            catch (SqlException ex)
            {
                _logger.LogWarning(ex, "BACKUP to staging path failed, trying SQL default backup directory");

                var fallback = await TryBackupViaSqlDefaultDirectoryAsync(
                    connectionString, database, localBakPath);
                if (fallback.Success)
                {
                    return fallback;
                }

                return (false,
                    $"BACKUP DATABASE failed: {ex.Message}. " +
                    "Ensure the SQL Server service account can write to wwwroot/backups/shared " +
                    "(run the API as Administrator once, or grant Modify permission manually).");
            }

            if (!await WaitForFileAsync(stagingPath))
            {
                return (false,
                    $"Backup completed but {BackupFileName} was not found at {stagingPath}. " +
                    "Check SQL Server error logs and folder permissions on wwwroot/backups/shared.");
            }

            File.Copy(stagingPath, localBakPath, true);
            _logger.LogInformation("Copied backup from {Source} to {Dest}", stagingPath, localBakPath);
            return (true, null);
        }

        private async Task<(bool Success, string? ErrorMessage)> TryBackupViaSqlDefaultDirectoryAsync(
            string connectionString,
            string database,
            string localBakPath)
        {
            var defaultBackupDir = await GetSqlServerDefaultBackupDirectoryAsync(connectionString);
            if (string.IsNullOrWhiteSpace(defaultBackupDir))
            {
                return (false, "Could not determine SQL Server default backup directory.");
            }

            var sqlBackupPath = Path.Combine(defaultBackupDir, $"InvoiceApp_{Guid.NewGuid():N}.bak");
            TryDeleteFile(sqlBackupPath);

            try
            {
                await ExecuteBackupDatabaseAsync(connectionString, database, sqlBackupPath);
            }
            catch (SqlException ex)
            {
                return (false, ex.Message);
            }

            if (!await WaitForFileCanReadAsync(sqlBackupPath))
            {
                return (false,
                    "Backup was created in SQL Server's folder but the API cannot read it (access denied). " +
                    "Use wwwroot/backups/shared instead — restart the API and try again.");
            }

            File.Copy(sqlBackupPath, localBakPath, true);
            TryDeleteFile(sqlBackupPath);
            return (true, null);
        }

        private async Task EnsureWindowsSqlBackupDirectoryAsync(string connectionString, string directory)
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return;
            }

            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var accounts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                @"NT SERVICE\MSSQLSERVER",
                @"NT Service\MSSQLSERVER"
            };

            try
            {
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                using var cmd = new SqlCommand(@"
                    SELECT service_account
                    FROM sys.dm_server_services
                    WHERE servicename LIKE 'SQL Server (%'
                      AND servicename NOT LIKE '%Agent%'
                      AND servicename NOT LIKE '%Browser%'
                      AND servicename NOT LIKE '%FullText%'", connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    if (!reader.IsDBNull(0))
                    {
                        var account = reader.GetString(0).Trim();
                        if (!string.IsNullOrEmpty(account))
                        {
                            accounts.Add(account);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query SQL Server service account for backup permissions");
            }

            foreach (var account in accounts)
            {
                TryGrantDirectoryPermission(directory, account);
            }
        }

        private void TryGrantDirectoryPermission(string directory, string account)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "icacls",
                    Arguments = $"\"{directory}\" /grant \"{account}:(OI)(CI)M\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(psi);
                process?.WaitForExit(15000);
                _logger.LogInformation("Granted backup folder access to {Account} (exit {Code})",
                    account, process?.ExitCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not grant folder permission to {Account}", account);
            }
        }

        private static void TryDeleteFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
            catch
            {
                // ignore
            }
        }

        private static async Task<bool> WaitForFileCanReadAsync(string path, int maxWaitMs = 30000)
        {
            for (var waited = 0; waited < maxWaitMs; waited += 500)
            {
                if (CanReadFile(path))
                {
                    return true;
                }

                await Task.Delay(500);
            }

            return CanReadFile(path);
        }

        private static bool CanReadFile(string path)
        {
            try
            {
                if (!File.Exists(path))
                {
                    return false;
                }

                using var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                return stream.Length > 0;
            }
            catch
            {
                return false;
            }
        }

        private async Task<string?> GetSqlServerDefaultBackupDirectoryAsync(string connectionString)
        {
            string? defaultBackupDir = null;

            try
            {
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                using var cmd = new SqlCommand("SELECT SERVERPROPERTY('InstanceDefaultBackupPath')", connection);
                defaultBackupDir = (await cmd.ExecuteScalarAsync())?.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query InstanceDefaultBackupPath");
            }

            if (!string.IsNullOrWhiteSpace(defaultBackupDir))
            {
                return defaultBackupDir;
            }

            try
            {
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                using var cmd = new SqlCommand(
                    "EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'BackupDirectory'",
                    connection);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync() && !reader.IsDBNull(1))
                {
                    return reader.GetString(1);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query backup directory from registry");
            }

            return null;
        }

        private async Task ExecuteBackupDatabaseAsync(
            string connectionString,
            string database,
            string sqlDiskPath)
        {
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            var escapedPath = sqlDiskPath.Replace("'", "''");
            var backupSql = $@"
                BACKUP DATABASE [{database}]
                TO DISK = N'{escapedPath}'
                WITH FORMAT, INIT,
                NAME = N'InvoiceApp Full Backup',
                SKIP, NOREWIND, NOUNLOAD,
                STATS = 10";

            using var command = new SqlCommand(backupSql, connection) { CommandTimeout = 600 };
            await command.ExecuteNonQueryAsync();
            _logger.LogInformation("BACKUP DATABASE completed to {Path}", sqlDiskPath);
        }

        private static async Task<bool> WaitForFileAsync(string path, int maxWaitMs = 30000)
        {
            for (var waited = 0; waited < maxWaitMs; waited += 500)
            {
                if (File.Exists(path))
                {
                    return true;
                }

                await Task.Delay(500);
            }

            return File.Exists(path);
        }

        private bool TryDockerCopyFromContainer(string containerName, string containerPath, string localPath)
        {
            try
            {
                var directory = Path.GetDirectoryName(localPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var psi = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"cp \"{containerName}:{containerPath}\" \"{localPath}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(psi);
                if (process == null)
                {
                    return false;
                }

                process.WaitForExit(120000);
                if (process.ExitCode != 0)
                {
                    var stderr = process.StandardError.ReadToEnd();
                    _logger.LogWarning(
                        "docker cp failed (exit {Code}): {Error}",
                        process.ExitCode,
                        stderr);
                }

                return process.ExitCode == 0 && File.Exists(localPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "docker cp failed for {Container}:{Path}", containerName, containerPath);
                return false;
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

                var apiInDocker = File.Exists("/.dockerenv") ||
                    !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"));
                var sqlInDocker = IsSqlServerInDocker(builder);

                var sqlRestorePath = await ResolveSqlServerRestorePathAsync(
                    backupFilePath, masterBuilder.ConnectionString, apiInDocker, sqlInDocker);

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
            catch (SqlException sqlEx) when (IsSqlVersionMismatchError(sqlEx))
            {
                _logger.LogError(sqlEx, "SQL Server version mismatch during .bak restore");
                return (false,
                    "SQL_VERSION_MISMATCH: " + sqlEx.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring database");
                return (false, ex.Message);
            }
        }

        private static bool IsSqlVersionMismatchError(SqlException ex)
        {
            return IsSqlVersionMismatchMessage(ex.Message) || ex.Number is 3169 or 3254;
        }

        private static bool IsSqlVersionMismatchMessage(string? message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return false;
            }

            return message.Contains("SQL_VERSION_MISMATCH", StringComparison.OrdinalIgnoreCase)
                || message.Contains("incompatible with this server", StringComparison.OrdinalIgnoreCase)
                || message.Contains("backed up on a server running", StringComparison.OrdinalIgnoreCase)
                || message.Contains("database version 998", StringComparison.OrdinalIgnoreCase)
                || message.Contains("supports version 958", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Locates JSON table export for cross-version restore (json-fallback/ or legacy database/*.json).
        /// </summary>
        private static string? FindJsonExportDirectory(string dbBackupDir)
        {
            var candidates = new[]
            {
                Path.Combine(dbBackupDir, "json-fallback"),
                dbBackupDir
            };

            foreach (var dir in candidates)
            {
                if (!Directory.Exists(dir))
                {
                    continue;
                }

                if (File.Exists(Path.Combine(dir, "_backup_metadata.json")))
                {
                    return dir;
                }

                var hasTableJson = Directory
                    .GetFiles(dir, "*.json")
                    .Any(f => !string.Equals(
                        Path.GetFileName(f),
                        "_backup_metadata.json",
                        StringComparison.OrdinalIgnoreCase));

                if (hasTableJson)
                {
                    return dir;
                }
            }

            return null;
        }

        /// <summary>
        /// Secondary export for restoring on older SQL Server (e.g. Docker 2022) when .bak version differs.
        /// Stored in database/json-fallback/ — not used unless .bak restore fails.
        /// </summary>
        private async Task ExportDatabaseAsJsonAsync(
            string backupDir, string connectionString, string database)
        {
            _logger.LogInformation("Exporting JSON fallback tables to {Dir}...", backupDir);

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

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

            foreach (var table in tables)
            {
                var schemaAndTable = table.Split('.');
                var schema = schemaAndTable[0];
                var tableName = schemaAndTable[1];
                var rows = new List<Dictionary<string, object?>>();

                using (var cmd = new SqlCommand($"SELECT * FROM [{schema}].[{tableName}]", connection))
                {
                    cmd.CommandTimeout = 120;
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var row = new Dictionary<string, object?>();
                        for (var i = 0; i < reader.FieldCount; i++)
                        {
                            var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                            if (value is byte[] bytes)
                                value = Convert.ToBase64String(bytes);
                            else if (value is DateTime dt)
                                value = dt.ToString("O");
                            else if (value is DateTimeOffset dto)
                                value = dto.ToString("O");
                            else if (value is TimeSpan ts)
                                value = ts.ToString();
                            row[reader.GetName(i)] = value;
                        }
                        rows.Add(row);
                    }
                }

                var safeTableName = table.Replace(".", "_").Replace("[", "").Replace("]", "");
                var jsonFile = Path.Combine(backupDir, $"{safeTableName}.json");
                var json = JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(jsonFile, json);
            }

            var metadata = new Dictionary<string, object>
            {
                ["exportDate"] = DateTime.Now.ToString("O"),
                ["database"] = database,
                ["exportType"] = "json_fallback_for_cross_version_restore",
                ["tables"] = tables
            };
            await File.WriteAllTextAsync(
                Path.Combine(backupDir, "_backup_metadata.json"),
                JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));
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
            bool apiInDocker,
            bool sqlInDocker)
        {
            if (!File.Exists(localBackupFilePath))
            {
                throw new FileNotFoundException("Backup file not found", localBackupFilePath);
            }

            var fileName = string.IsNullOrWhiteSpace(Path.GetFileName(localBackupFilePath))
                ? BackupFileName
                : Path.GetFileName(localBackupFilePath)!;

            if (apiInDocker)
            {
                var sharedBackupDir = "/app/wwwroot/backups/shared";
                Directory.CreateDirectory(sharedBackupDir);

                var sharedBackupPath = Path.Combine(sharedBackupDir, fileName);
                File.Copy(localBackupFilePath, sharedBackupPath, true);
                return $"/var/opt/mssql/backup/{fileName}";
            }

            if (sqlInDocker)
            {
                return await StageRestoreFileForDockerSqlAsync(
                    localBackupFilePath, masterConnectionString, fileName);
            }

            return await StageRestoreFileForWindowsLocalSqlAsync(
                localBackupFilePath, masterConnectionString, fileName);
        }

        private async Task<string> StageRestoreFileForWindowsLocalSqlAsync(
            string localBackupFilePath,
            string masterConnectionString,
            string fileName)
        {
            var stagingDir = Path.Combine(_backupDirectory, "shared");
            Directory.CreateDirectory(stagingDir);
            await EnsureWindowsSqlBackupDirectoryAsync(masterConnectionString, stagingDir);

            var stagingPath = Path.Combine(stagingDir, fileName);
            File.Copy(localBackupFilePath, stagingPath, true);
            _logger.LogInformation("Copied backup for restore to {Path}", stagingPath);
            return stagingPath;
        }

        private async Task<string> StageRestoreFileForDockerSqlAsync(
            string localBackupFilePath,
            string masterConnectionString,
            string fileName)
        {
            var stagingDir = Path.Combine(_backupDirectory, "shared");
            Directory.CreateDirectory(stagingDir);
            await EnsureWindowsSqlBackupDirectoryAsync(masterConnectionString, stagingDir);

            var stagingPath = Path.Combine(stagingDir, fileName);
            File.Copy(localBackupFilePath, stagingPath, true);

            var containerName = Environment.GetEnvironmentVariable("BACKUP_SQL_CONTAINER_NAME") ?? "invoiceapp-db";
            var containerPaths = new[]
            {
                $"/var/opt/mssql/backup/{fileName}",
                $"/var/opt/mssql/data/{fileName}"
            };

            foreach (var containerPath in containerPaths)
            {
                if (TryDockerCopyToContainer(containerName, stagingPath, containerPath))
                {
                    _logger.LogInformation(
                        "Copied restore file into container {Container}:{Path}",
                        containerName, containerPath);
                    return containerPath;
                }
            }

            throw new IOException(
                $"Could not copy backup into Docker container '{containerName}'. " +
                "Ensure Docker is running and the SQL container is available.");
        }

        private bool TryDockerCopyToContainer(string containerName, string localPath, string containerPath)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"cp \"{localPath}\" \"{containerName}:{containerPath}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(psi);
                if (process == null)
                {
                    return false;
                }

                process.WaitForExit(120000);
                return process.ExitCode == 0;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "docker cp to container failed for {Container}:{Path}", containerName, containerPath);
                return false;
            }
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

        private static void EnsureDirectoryExists(string directoryPath)
        {
            if (!Directory.Exists(directoryPath))
            {
                Directory.CreateDirectory(directoryPath);
            }
        }

        private static void ClearDirectoryContents(string directoryPath)
        {
            if (!Directory.Exists(directoryPath))
            {
                return;
            }

            foreach (var file in Directory.GetFiles(directoryPath))
            {
                File.Delete(file);
            }

            foreach (var dir in Directory.GetDirectories(directoryPath))
            {
                Directory.Delete(dir, true);
            }
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            if (!Directory.Exists(sourceDir))
                return;

            EnsureDirectoryExists(destDir);

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
