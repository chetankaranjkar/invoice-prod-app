using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Infrastructure.Data;

namespace InvoiceApp.Infrastructure.Repositories
{
    public class RecurringInvoiceRepository : IRecurringInvoiceRepository
    {
        private readonly AppDbContext _context;

        public RecurringInvoiceRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<RecurringInvoice?> GetByIdAsync(int id)
        {
            return await _context.RecurringInvoices
                .Include(r => r.RecurringItems)
                .Include(r => r.Customer)
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<List<RecurringInvoice>> GetByUserIdAsync(Guid userId)
        {
            return await _context.RecurringInvoices
                .AsNoTracking()
                .Include(r => r.RecurringItems)
                .Include(r => r.Customer)
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RecurringInvoice>> GetActiveRecurringInvoicesAsync()
        {
            var now = DateTime.UtcNow;
            return await _context.RecurringInvoices
                .AsNoTracking()
                .Include(r => r.RecurringItems)
                .Include(r => r.Customer)
                .Include(r => r.User)
                .Where(r => r.IsActive 
                    && r.StartDate <= now
                    && (r.EndDate == null || r.EndDate >= now)
                    && (r.NumberOfOccurrences == null || r.GeneratedCount < r.NumberOfOccurrences)
                    && (r.NextGenerationDate == null || r.NextGenerationDate <= now))
                .ToListAsync();
        }

        public async Task<RecurringInvoice> AddAsync(RecurringInvoice recurringInvoice)
        {
            _context.RecurringInvoices.Add(recurringInvoice);
            await _context.SaveChangesAsync();
            return recurringInvoice;
        }

        public async Task UpdateAsync(RecurringInvoice recurringInvoice)
        {
            _context.RecurringInvoices.Update(recurringInvoice);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var recurringInvoice = await _context.RecurringInvoices
                .Include(r => r.RecurringItems)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (recurringInvoice == null)
                return false;

            _context.RecurringInvoiceItems.RemoveRange(recurringInvoice.RecurringItems);
            _context.RecurringInvoices.Remove(recurringInvoice);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
