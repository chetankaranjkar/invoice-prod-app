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
        Task<Invoice> AddAsync(Invoice invoice);
        Task UpdateAsync(Invoice invoice);
        Task<string> GenerateInvoiceNumberAsync(Guid userId, string prefix);
    }
}
