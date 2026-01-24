using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace InvoiceApp.Infrastructure.Repositories
{
    public class ErrorLogRepository : IErrorLogRepository
    {
        private readonly AppDbContext _context;

        public ErrorLogRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ErrorLog> CreateAsync(ErrorLog errorLog)
        {
            errorLog.CreatedAt = DateTime.UtcNow;
            _context.ErrorLogs.Add(errorLog);
            await _context.SaveChangesAsync();
            return errorLog;
        }

        public async Task<List<ErrorLog>> GetAllAsync(int page = 1, int pageSize = 50)
        {
            return await _context.ErrorLogs
                .OrderByDescending(e => e.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<ErrorLog?> GetByIdAsync(int id)
        {
            return await _context.ErrorLogs.FindAsync(id);
        }

        public async Task<List<ErrorLog>> GetUnresolvedAsync()
        {
            return await _context.ErrorLogs
                .Where(e => !e.IsResolved)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<bool> MarkAsResolvedAsync(int id, string resolvedBy, string? resolutionNotes = null)
        {
            var errorLog = await _context.ErrorLogs.FindAsync(id);
            if (errorLog == null)
                return false;

            errorLog.IsResolved = true;
            errorLog.ResolvedBy = resolvedBy;
            errorLog.ResolvedAt = DateTime.UtcNow;
            errorLog.ResolutionNotes = resolutionNotes;
            errorLog.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> GetCountAsync()
        {
            return await _context.ErrorLogs.CountAsync();
        }

        public async Task<int> GetUnresolvedCountAsync()
        {
            return await _context.ErrorLogs.CountAsync(e => !e.IsResolved);
        }
    }
}
