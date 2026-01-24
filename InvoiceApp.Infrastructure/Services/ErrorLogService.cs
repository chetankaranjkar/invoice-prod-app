using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace InvoiceApp.Infrastructure.Services
{
    public class ErrorLogService : IErrorLogService
    {
        private readonly IErrorLogRepository _errorLogRepository;
        private readonly ILogger<ErrorLogService> _logger;

        public ErrorLogService(IErrorLogRepository errorLogRepository, ILogger<ErrorLogService> logger)
        {
            _errorLogRepository = errorLogRepository;
            _logger = logger;
        }

        public async Task<ErrorLog> LogErrorAsync(
            Exception exception,
            string? userId = null,
            string? userEmail = null,
            string? requestPath = null,
            string? requestMethod = null,
            string? requestBody = null,
            string? queryString = null,
            string? userAgent = null,
            string? ipAddress = null,
            object? additionalData = null)
        {
            try
            {
                var errorLog = new ErrorLog
                {
                    ErrorType = exception.GetType().Name,
                    Message = exception.Message,
                    StackTrace = exception.StackTrace,
                    InnerException = exception.InnerException?.ToString(),
                    Source = exception.Source,
                    UserId = userId,
                    UserEmail = userEmail,
                    RequestPath = requestPath,
                    RequestMethod = requestMethod,
                    RequestBody = requestBody,
                    QueryString = queryString,
                    UserAgent = userAgent,
                    IpAddress = ipAddress,
                    AdditionalData = additionalData != null ? JsonSerializer.Serialize(additionalData) : null,
                    IsResolved = false
                };

                return await _errorLogRepository.CreateAsync(errorLog);
            }
            catch (Exception ex)
            {
                // If error logging itself fails, log to standard logger
                _logger.LogError(ex, "Failed to log error to database. Original error: {OriginalError}", exception.Message);
                throw; // Re-throw to ensure the original error is still visible
            }
        }

        public async Task<List<ErrorLog>> GetAllErrorsAsync(int page = 1, int pageSize = 50)
        {
            return await _errorLogRepository.GetAllAsync(page, pageSize);
        }

        public async Task<ErrorLog?> GetErrorByIdAsync(int id)
        {
            return await _errorLogRepository.GetByIdAsync(id);
        }

        public async Task<List<ErrorLog>> GetUnresolvedErrorsAsync()
        {
            return await _errorLogRepository.GetUnresolvedAsync();
        }

        public async Task<bool> MarkErrorAsResolvedAsync(int id, string resolvedBy, string? resolutionNotes = null)
        {
            return await _errorLogRepository.MarkAsResolvedAsync(id, resolvedBy, resolutionNotes);
        }

        public async Task<ErrorLogStats> GetErrorStatsAsync()
        {
            var totalErrors = await _errorLogRepository.GetCountAsync();
            var unresolvedErrors = await _errorLogRepository.GetUnresolvedCountAsync();

            // Get errors from last 24 hours and 7 days
            var allErrors = await _errorLogRepository.GetAllAsync(1, 1000); // Get more to calculate stats
            var last24Hours = DateTime.UtcNow.AddHours(-24);
            var last7Days = DateTime.UtcNow.AddDays(-7);

            var errorsLast24Hours = allErrors.Count(e => e.CreatedAt >= last24Hours);
            var errorsLast7Days = allErrors.Count(e => e.CreatedAt >= last7Days);

            return new ErrorLogStats
            {
                TotalErrors = totalErrors,
                UnresolvedErrors = unresolvedErrors,
                ErrorsLast24Hours = errorsLast24Hours,
                ErrorsLast7Days = errorsLast7Days
            };
        }
    }
}
