using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;

namespace InvoiceApp.Infrastructure.Repositories
{
    public class InvoiceLayoutRepository : IInvoiceLayoutRepository
    {
        private readonly AppDbContext _context;

        public InvoiceLayoutRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<InvoiceLayoutConfig?> GetByIdAsync(int id)
        {
            return await _context.InvoiceLayoutConfigs.FirstOrDefaultAsync(l => l.Id == id);
        }

        public async Task<List<InvoiceLayoutConfig>> GetByUserIdAsync(Guid userId)
        {
            return await _context.InvoiceLayoutConfigs
                .AsNoTracking()
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.IsDefault)
                .ThenByDescending(l => l.CreatedAt)
                .ToListAsync();
        }

        public async Task<InvoiceLayoutConfig> AddAsync(InvoiceLayoutConfig layout)
        {
            _context.InvoiceLayoutConfigs.Add(layout);
            await _context.SaveChangesAsync();
            return layout;
        }

        public async Task UpdateAsync(InvoiceLayoutConfig layout)
        {
            _context.InvoiceLayoutConfigs.Update(layout);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var layout = await _context.InvoiceLayoutConfigs.FirstOrDefaultAsync(l => l.Id == id);
            if (layout == null)
                return false;

            _context.InvoiceLayoutConfigs.Remove(layout);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<InvoiceLayoutConfig?> GetDefaultAsync(Guid userId)
        {
            return await _context.InvoiceLayoutConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.UserId == userId && l.IsDefault);
        }

        public async Task ClearDefaultAsync(Guid userId)
        {
            var defaults = await _context.InvoiceLayoutConfigs
                .Where(l => l.UserId == userId && l.IsDefault)
                .ToListAsync();

            if (defaults.Count == 0)
                return;

            foreach (var layout in defaults)
            {
                layout.IsDefault = false;
                layout.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }
    }
}
