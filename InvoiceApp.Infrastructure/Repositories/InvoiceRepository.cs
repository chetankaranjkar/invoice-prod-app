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
    public class InvoiceRepository : IInvoiceRepository
    {
        private readonly AppDbContext _context;

        public InvoiceRepository(AppDbContext context)
        {
            _context = context;
        }

        // ... keep all your existing methods as they are
        public async Task<Invoice?> GetByIdAsync(int id)
        {
            return await _context.Invoices
                .Include(i => i.Customer)
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .FirstOrDefaultAsync(i => i.Id == id);
        }

        public async Task<List<Invoice>> GetByUserIdAsync(Guid userId)
        {
            return await _context.Invoices
                .Include(i => i.Customer)
                .Where(i => i.UserId == userId)
                .OrderByDescending(i => i.InvoiceDate)
                .ToListAsync();
        }

        public async Task<Invoice> AddAsync(Invoice invoice)
        {
            _context.Invoices.Add(invoice);
            await _context.SaveChangesAsync();
            return invoice;
        }

        public async Task UpdateAsync(Invoice invoice)
        {
            _context.Invoices.Update(invoice);
            await _context.SaveChangesAsync();
        }

        public async Task<string> GenerateInvoiceNumberAsync(Guid userId, string prefix)
        {
            var lastInvoice = await _context.Invoices
                .Where(i => i.UserId == userId && i.InvoiceNumber.StartsWith(prefix))
                .OrderByDescending(i => i.Id)
                .FirstOrDefaultAsync();

            var nextNumber = 1;
            if (lastInvoice != null)
            {
                var lastNumberStr = lastInvoice.InvoiceNumber.Replace(prefix, "");
                if (int.TryParse(lastNumberStr, out int lastNumber))
                {
                    nextNumber = lastNumber + 1;
                }
            }

            return $"{prefix}{nextNumber:D5}";
        }
    }
}