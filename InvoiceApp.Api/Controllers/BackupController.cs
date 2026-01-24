using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;
using System.IO;
using System.IO.Compression;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using System.Linq;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "MasterUser,Admin")]
    public class BackupController : ControllerBase
    {
        private readonly IBackupService _backupService;
        private readonly IUserContext _userContext;
        private readonly ILogger<BackupController> _logger;
        private readonly IAuditService _auditService;
        private readonly IErrorLogService _errorLogService;

        public BackupController(
            IBackupService backupService,
            IUserContext userContext,
            ILogger<BackupController> logger,
            IAuditService auditService,
            IErrorLogService errorLogService)
        {
            _backupService = backupService;
            _userContext = userContext;
            _logger = logger;
            _auditService = auditService;
            _errorLogService = errorLogService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateBackup()
        {
            var currentUserId = _userContext.GetCurrentUserId();
            var currentUserEmail = _userContext.GetCurrentUserEmail();
            var currentUserName = _userContext.GetCurrentUserName();

            try
            {
                if (currentUserId == null)
                    return Unauthorized("User not authenticated");

                _logger.LogInformation("Starting backup creation by user {UserId}", currentUserId);

                var backupResult = await _backupService.CreateBackupAsync();

                if (!backupResult.Success)
                {
                    _logger.LogError("Backup creation failed: {Error}", backupResult.ErrorMessage);
                    return StatusCode(500, new { error = backupResult.ErrorMessage });
                }

                // Validate backup result
                if (string.IsNullOrEmpty(backupResult.FilePath))
                {
                    _logger.LogError("Backup created but FilePath is null or empty");
                    return StatusCode(500, new { error = "Backup file path is missing" });
                }

                if (!System.IO.File.Exists(backupResult.FilePath))
                {
                    _logger.LogError("Backup file does not exist: {FilePath}", backupResult.FilePath);
                    return StatusCode(500, new { error = "Backup file was not created" });
                }

                // Audit log
                try
                {
                    await _auditService.LogActionAsync(
                        currentUserId.Value,
                        currentUserName ?? "Unknown",
                        currentUserEmail ?? "Unknown",
                        "BACKUP",
                        "System",
                        "BACKUP",
                        "Data Backup",
                        null,
                        new { backupFileName = backupResult.FileName, backupSize = backupResult.FileSize },
                        $"Created data backup: {backupResult.FileName}",
                        null,
                        HttpContext);
                }
                catch (Exception auditEx)
                {
                    _logger.LogWarning(auditEx, "Failed to log backup action to audit log");
                    // Continue even if audit logging fails
                }

                // Return the backup file
                try
                {
                    var fileBytes = await System.IO.File.ReadAllBytesAsync(backupResult.FilePath);
                    return File(fileBytes, "application/zip", backupResult.FileName ?? "backup.zip");
                }
                catch (Exception fileEx)
                {
                    _logger.LogError(fileEx, "Failed to read backup file: {FilePath}", backupResult.FilePath);
                    return StatusCode(500, new { error = $"Failed to read backup file: {fileEx.Message}" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating backup");
                
                // Log to error log service
                try
                {
                    await _errorLogService.LogErrorAsync(
                        ex,
                        userId: currentUserId?.ToString(),
                        userEmail: currentUserEmail,
                        requestPath: "/api/Backup/create",
                        requestMethod: "POST",
                        userAgent: Request.Headers["User-Agent"].ToString(),
                        ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString()
                    );
                }
                catch (Exception logEx)
                {
                    _logger.LogWarning(logEx, "Failed to log error to error log service");
                }
                
                return StatusCode(500, new { error = $"An error occurred while creating backup: {ex.Message}" });
            }
        }

        [HttpPost("restore")]
        [DisableRequestSizeLimit] // Disable request size limit for backup restore
        public async Task<IActionResult> RestoreBackup(IFormFile file)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserEmail = _userContext.GetCurrentUserEmail();
                var currentUserName = _userContext.GetCurrentUserName();

                if (currentUserId == null)
                    return Unauthorized("User not authenticated");

                if (file == null || file.Length == 0)
                    return BadRequest(new { error = "No backup file provided" });

                // Validate file extension
                var allowedExtensions = new[] { ".zip" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { error = "Invalid file type. Only ZIP files are allowed." });

                // Validate file size (max 1GB)
                const long maxFileSize = 1024 * 1024 * 1024; // 1GB
                if (file.Length > maxFileSize)
                    return BadRequest(new { error = "File size exceeds maximum allowed size (1GB)" });

                _logger.LogInformation("Starting backup restore by user {UserId}, file: {FileName}", currentUserId, file.FileName);

                // Save uploaded file temporarily
                var tempFilePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".zip");
                using (var stream = new FileStream(tempFilePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                try
                {
                    var restoreResult = await _backupService.RestoreBackupAsync(tempFilePath);

                    if (!restoreResult.Success)
                    {
                        _logger.LogError("Backup restore failed: {Error}", restoreResult.ErrorMessage);
                        return StatusCode(500, new { error = restoreResult.ErrorMessage });
                    }

                    // Audit log
                    await _auditService.LogActionAsync(
                        currentUserId.Value,
                        currentUserName ?? "Unknown",
                        currentUserEmail ?? "Unknown",
                        "RESTORE",
                        "System",
                        "RESTORE",
                        "Data Restore",
                        null,
                        new { backupFileName = file.FileName },
                        $"Restored data from backup: {file.FileName}",
                        null,
                        HttpContext);

                    return Ok(new { message = "Backup restored successfully" });
                }
                finally
                {
                    // Clean up temporary file
                    if (System.IO.File.Exists(tempFilePath))
                    {
                        try
                        {
                            System.IO.File.Delete(tempFilePath);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to delete temporary file: {FilePath}", tempFilePath);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring backup");
                return StatusCode(500, new { error = "An error occurred while restoring backup" });
            }
        }

        [HttpGet("list")]
        public async Task<IActionResult> ListBackups()
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                if (currentUserId == null)
                    return Unauthorized("User not authenticated");

                var backups = await _backupService.ListBackupsAsync();
                return Ok(backups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing backups");
                return StatusCode(500, new { error = "An error occurred while listing backups" });
            }
        }
    }
}
