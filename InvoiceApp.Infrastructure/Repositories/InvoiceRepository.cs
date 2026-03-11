using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
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
                .Include(i => i.User) // Include User for admin view
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .FirstOrDefaultAsync(i => i.Id == id);
        }

        public async Task<List<Invoice>> GetByUserIdAsync(Guid userId)
        {
            // Use AsNoTracking for read-only operations to improve performance
            return await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Customer)
                .Include(i => i.User) // Include User for admin view
                .Where(i => i.UserId == userId)
                .OrderByDescending(i => i.InvoiceDate)
                .ToListAsync();
        }

        public async Task<List<Invoice>> GetByAdminIdAsync(Guid adminId)
        {
            // Get user IDs of all users created by this admin
            var createdUserIds = await _context.Users
                .AsNoTracking()
                .Where(u => u.CreatedBy == adminId)
                .Select(u => u.Id)
                .ToListAsync();

            // Build list of all user IDs: admin themselves + all users they created
            var allUserIds = new List<Guid> { adminId };
            allUserIds.AddRange(createdUserIds);

            // Remove duplicates (in case adminId is somehow in createdUserIds)
            allUserIds = allUserIds.Distinct().ToList();

            // Get invoices from all users created by this admin OR invoices created by the admin themselves
            // Use AsNoTracking for read-only operations to improve performance
            var invoices = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Customer)
                .Include(i => i.User) // Include User for admin view
                .Where(i => allUserIds.Contains(i.UserId))
                .OrderByDescending(i => i.InvoiceDate)
                .ToListAsync();

            return invoices;
        }

        public async Task<List<Invoice>> GetAllAsync()
        {
            // Get all invoices (for MasterUser)
            // Use AsNoTracking for read-only operations to improve performance
            return await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Customer)
                .Include(i => i.User) // Include User for admin view
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

        public async Task<bool> DeleteAsync(int id)
        {
            var invoice = await _context.Invoices
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .FirstOrDefaultAsync(i => i.Id == id);
            
            if (invoice == null)
                return false;

            // Remove related entities
            _context.InvoiceItems.RemoveRange(invoice.InvoiceItems);
            _context.Payments.RemoveRange(invoice.Payments);
            _context.Invoices.Remove(invoice);
            
            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>Get Indian financial year string (e.g. 2024-25 for Apr 2024 - Mar 2025)</summary>
        private static string GetFinancialYearString(DateTime date)
        {
            var year = date.Year;
            var month = date.Month;
            int startYear = month >= 4 ? year : year - 1;
            int endYear = startYear + 1;
            return $"{startYear}-{endYear % 100:D2}";
        }

        public async Task<string> GenerateInvoiceNumberAsync(Guid userId, string prefix, DateTime? forDate = null)
        {
            var dateForFy = forDate ?? DateTime.UtcNow;
            var fy = GetFinancialYearString(dateForFy);
            var fySuffix = $" / {fy}";

            // Get invoices for this user with same prefix AND same financial year (format: "INV0001 / 2024-25")
            var invoices = await _context.Invoices
                .AsNoTracking()
                .Where(i => i.UserId == userId && i.InvoiceNumber.StartsWith(prefix) && i.InvoiceNumber.EndsWith(fySuffix))
                .Select(i => i.InvoiceNumber)
                .ToListAsync();

            var nextNumber = 1;

            if (invoices.Any())
            {
                var numbers = invoices
                    .Select(inv =>
                    {
                        var withoutPrefix = inv.StartsWith(prefix) ? inv.Substring(prefix.Length) : inv;
                        var withoutFy = withoutPrefix.Replace(fySuffix, "").Trim();
                        if (int.TryParse(withoutFy.TrimStart('0'), out int num))
                            return num;
                        if (int.TryParse(withoutFy, out int n))
                            return n;
                        var digits = Regex.Match(withoutFy, @"\d+").Value;
                        return int.TryParse(digits, out int d) ? d : 0;
                    })
                    .Where(n => n > 0)
                    .ToList();

                if (numbers.Any())
                    nextNumber = numbers.Max() + 1;
            }

            var invoiceNumber = $"{prefix}{nextNumber}{fySuffix}";
            var attempts = 0;
            const int maxAttempts = 1000;

            while (await _context.Invoices.AsNoTracking().AnyAsync(i => i.UserId == userId && i.InvoiceNumber == invoiceNumber))
            {
                nextNumber++;
                invoiceNumber = $"{prefix}{nextNumber}{fySuffix}";
                if (++attempts >= maxAttempts)
                {
                    var timestamp = dateForFy.ToString("yyyyMMddHHmmss");
                    invoiceNumber = $"{prefix}{timestamp}{fySuffix}";
                    break;
                }
            }

            return invoiceNumber;
        }

        public async Task<bool> InvoiceNumberExistsAsync(Guid userId, string invoiceNumber)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return false;
            return await _context.Invoices
                .AsNoTracking()
                .AnyAsync(i => i.UserId == userId && i.InvoiceNumber == invoiceNumber.Trim());
        }
    }
}