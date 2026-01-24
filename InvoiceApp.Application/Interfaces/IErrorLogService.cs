using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IErrorLogService
    {
        Task<ErrorLog> LogErrorAsync(
            Exception exception,
            string? userId = null,
            string? userEmail = null,
            string? requestPath = null,
            string? requestMethod = null,
            string? requestBody = null,
            string? queryString = null,
            string? userAgent = null,
            string? ipAddress = null,
            object? additionalData = null);

        Task<List<ErrorLog>> GetAllErrorsAsync(int page = 1, int pageSize = 50);
        Task<ErrorLog?> GetErrorByIdAsync(int id);
        Task<List<ErrorLog>> GetUnresolvedErrorsAsync();
        Task<bool> MarkErrorAsResolvedAsync(int id, string resolvedBy, string? resolutionNotes = null);
        Task<ErrorLogStats> GetErrorStatsAsync();
    }

    public class ErrorLogStats
    {
        public int TotalErrors { get; set; }
        public int UnresolvedErrors { get; set; }
        public int ErrorsLast24Hours { get; set; }
        public int ErrorsLast7Days { get; set; }
    }
}
