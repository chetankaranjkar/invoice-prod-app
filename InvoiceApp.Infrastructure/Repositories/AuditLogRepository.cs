using AutoMapper;
using InvoiceApp.Application.DTOs;
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
    public class AuditLogRepository : IAuditLogRepository
    {
        private readonly AppDbContext _context;
        private readonly IMapper _mapper;

        public AuditLogRepository(AppDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<AuditLogDto> CreateAuditLogAsync(AuditLogDto auditLogDto)
        {
            var auditLog = _mapper.Map<AuditLog>(auditLogDto);
            auditLog.CreatedAt = DateTime.UtcNow;
            
            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            return _mapper.Map<AuditLogDto>(auditLog);
        }

        public async Task<List<AuditLogDto>> GetAuditLogsAsync(AuditLogFilterDto filter)
        {
            var query = _context.AuditLogs.AsQueryable();

            // Apply filters
            if (filter.UserId.HasValue)
            {
                query = query.Where(a => a.UserId == filter.UserId.Value);
            }

            if (!string.IsNullOrEmpty(filter.Action))
            {
                query = query.Where(a => a.Action == filter.Action);
            }

            if (!string.IsNullOrEmpty(filter.EntityType))
            {
                query = query.Where(a => a.EntityType == filter.EntityType);
            }

            if (filter.StartDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt >= filter.StartDate.Value);
            }

            if (filter.EndDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt <= filter.EndDate.Value);
            }

            // Order by most recent first
            query = query.OrderByDescending(a => a.CreatedAt);

            // Apply pagination
            var skip = (filter.PageNumber - 1) * filter.PageSize;
            query = query.Skip(skip).Take(filter.PageSize);

            var auditLogs = await query.ToListAsync();
            return _mapper.Map<List<AuditLogDto>>(auditLogs);
        }

        public async Task<int> GetAuditLogsCountAsync(AuditLogFilterDto filter)
        {
            var query = _context.AuditLogs.AsQueryable();

            // Apply same filters as GetAuditLogsAsync
            if (filter.UserId.HasValue)
            {
                query = query.Where(a => a.UserId == filter.UserId.Value);
            }

            if (!string.IsNullOrEmpty(filter.Action))
            {
                query = query.Where(a => a.Action == filter.Action);
            }

            if (!string.IsNullOrEmpty(filter.EntityType))
            {
                query = query.Where(a => a.EntityType == filter.EntityType);
            }

            if (filter.StartDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt >= filter.StartDate.Value);
            }

            if (filter.EndDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt <= filter.EndDate.Value);
            }

            return await query.CountAsync();
        }
    }
}

