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
    public class InvoiceTemplateRepository : IInvoiceTemplateRepository
    {
        private readonly AppDbContext _context;

        public InvoiceTemplateRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<InvoiceTemplate?> GetByIdAsync(int id)
        {
            return await _context.InvoiceTemplates
                .Include(t => t.TemplateItems)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<List<InvoiceTemplate>> GetByUserIdAsync(Guid userId)
        {
            return await _context.InvoiceTemplates
                .AsNoTracking()
                .Include(t => t.TemplateItems)
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();
        }

        public async Task<InvoiceTemplate> AddAsync(InvoiceTemplate template)
        {
            _context.InvoiceTemplates.Add(template);
            await _context.SaveChangesAsync();
            return template;
        }

        public async Task UpdateAsync(InvoiceTemplate template)
        {
            _context.InvoiceTemplates.Update(template);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var template = await _context.InvoiceTemplates
                .Include(t => t.TemplateItems)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (template == null)
                return false;

            _context.InvoiceTemplateItems.RemoveRange(template.TemplateItems);
            _context.InvoiceTemplates.Remove(template);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
