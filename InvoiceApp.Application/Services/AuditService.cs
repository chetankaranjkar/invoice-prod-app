using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Services
{
    public interface IAuditService
    {
        Task LogActionAsync(
            Guid? userId,
            string? userName,
            string? userEmail,
            string action,
            string entityType,
            string? entityId = null,
            string? entityName = null,
            object? oldValues = null,
            object? newValues = null,
            string? changes = null,
            string? remarks = null,
            HttpContext? httpContext = null);
    }

    public class AuditService : IAuditService
    {
        private readonly IAuditLogRepository _auditLogRepository;

        public AuditService(IAuditLogRepository auditLogRepository)
        {
            _auditLogRepository = auditLogRepository;
        }

        public async Task LogActionAsync(
            Guid? userId,
            string? userName,
            string? userEmail,
            string action,
            string entityType,
            string? entityId = null,
            string? entityName = null,
            object? oldValues = null,
            object? newValues = null,
            string? changes = null,
            string? remarks = null,
            HttpContext? httpContext = null)
        {
            try
            {
                var auditLog = new AuditLogDto
                {
                    UserId = userId,
                    UserName = userName,
                    UserEmail = userEmail,
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityName = entityName,
                    OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                    NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                    Changes = changes,
                    Remarks = remarks,
                    IpAddress = httpContext?.Connection?.RemoteIpAddress?.ToString(),
                    UserAgent = httpContext?.Request?.Headers["User-Agent"].ToString()
                };

                await _auditLogRepository.CreateAuditLogAsync(auditLog);
            }
            catch (Exception)
            {
                // Silently fail audit logging to not break the main operation
                // In production, you might want to log this to a separate error log
            }
        }
    }
}

