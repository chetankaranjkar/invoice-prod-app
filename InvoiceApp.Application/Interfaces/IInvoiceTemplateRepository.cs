using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceTemplateRepository
    {
        Task<InvoiceTemplate?> GetByIdAsync(int id);
        Task<List<InvoiceTemplate>> GetByUserIdAsync(Guid userId);
        Task<InvoiceTemplate> AddAsync(InvoiceTemplate template);
        Task UpdateAsync(InvoiceTemplate template);
        Task<bool> DeleteAsync(int id);
    }
}
