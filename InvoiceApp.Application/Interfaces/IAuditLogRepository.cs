using InvoiceApp.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IAuditLogRepository
    {
        Task<AuditLogDto> CreateAuditLogAsync(AuditLogDto auditLog);
        Task<List<AuditLogDto>> GetAuditLogsAsync(AuditLogFilterDto filter);
        Task<int> GetAuditLogsCountAsync(AuditLogFilterDto filter);
    }
}

