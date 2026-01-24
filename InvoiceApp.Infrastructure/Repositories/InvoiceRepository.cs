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

        public async Task<string> GenerateInvoiceNumberAsync(Guid userId, string prefix)
        {
            // Get all invoices for this user with the same prefix
            var invoices = await _context.Invoices
                .AsNoTracking()
                .Where(i => i.UserId == userId && i.InvoiceNumber.StartsWith(prefix))
                .Select(i => i.InvoiceNumber)
                .ToListAsync();

            var nextNumber = 1;
            
            if (invoices.Any())
            {
                // Extract numbers from all invoice numbers and find the maximum
                // Handle both formats: "INV00001" and "INV4ADB0001" (from seed data)
                var numbers = invoices
                    .Select(inv => 
                    {
                        var numberStr = inv.Replace(prefix, "");
                        // Try to parse the entire remaining string as a number
                        if (int.TryParse(numberStr, out int num))
                            return num;
                        // If that fails, try to extract trailing digits (for seed data format)
                        var trailingDigits = Regex.Match(numberStr, @"\d+$");
                        if (trailingDigits.Success && int.TryParse(trailingDigits.Value, out int trailingNum))
                            return trailingNum;
                        return 0;
                    })
                    .Where(n => n > 0)
                    .ToList();

                if (numbers.Any())
                {
                    nextNumber = numbers.Max() + 1;
                }
            }

            // Ensure uniqueness by checking if the generated number already exists
            // This handles race conditions and ensures we never create duplicates
            string invoiceNumber;
            int attempts = 0;
            const int maxAttempts = 1000; // Increased limit for safety
            
            do
            {
                invoiceNumber = $"{prefix}{nextNumber:D5}";
                var exists = await _context.Invoices
                    .AsNoTracking()
                    .AnyAsync(i => i.InvoiceNumber == invoiceNumber);
                
                if (!exists)
                    break;
                    
                nextNumber++;
                attempts++;
            } while (attempts < maxAttempts);

            if (attempts >= maxAttempts)
            {
                // Fallback: use timestamp-based number if we can't find a unique sequential number
                var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
                invoiceNumber = $"{prefix}{timestamp}";
            }

            return invoiceNumber;
        }
    }
}