using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IErrorLogRepository
    {
        Task<ErrorLog> CreateAsync(ErrorLog errorLog);
        Task<List<ErrorLog>> GetAllAsync(int page = 1, int pageSize = 50);
        Task<ErrorLog?> GetByIdAsync(int id);
        Task<List<ErrorLog>> GetUnresolvedAsync();
        Task<bool> MarkAsResolvedAsync(int id, string resolvedBy, string? resolutionNotes = null);
        Task<int> GetCountAsync();
        Task<int> GetUnresolvedCountAsync();
    }
}
