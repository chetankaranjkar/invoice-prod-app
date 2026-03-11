using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceRepository
    {
        Task<Invoice?> GetByIdAsync(int id);
        Task<List<Invoice>> GetByUserIdAsync(Guid userId);
        Task<List<Invoice>> GetByAdminIdAsync(Guid adminId); // Get invoices from all users created by admin
        Task<List<Invoice>> GetAllAsync(); // Get all invoices (for MasterUser)
        Task<Invoice> AddAsync(Invoice invoice);
        Task UpdateAsync(Invoice invoice);
        Task<bool> DeleteAsync(int id);
        Task<string> GenerateInvoiceNumberAsync(Guid userId, string prefix, DateTime? forDate = null);
        /// <summary>Check if an invoice number already exists for the given user.</summary>
        Task<bool> InvoiceNumberExistsAsync(Guid userId, string invoiceNumber);
    }
}
