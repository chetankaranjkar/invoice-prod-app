using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceLayoutRepository
    {
        Task<InvoiceLayoutConfig?> GetByIdAsync(int id);
        Task<List<InvoiceLayoutConfig>> GetByUserIdAsync(Guid userId);
        Task<InvoiceLayoutConfig> AddAsync(InvoiceLayoutConfig layout);
        Task UpdateAsync(InvoiceLayoutConfig layout);
        Task<bool> DeleteAsync(int id);
        Task<InvoiceLayoutConfig?> GetDefaultAsync(Guid userId);
        Task ClearDefaultAsync(Guid userId);
    }
}
