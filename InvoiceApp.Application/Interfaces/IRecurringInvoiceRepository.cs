using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IRecurringInvoiceRepository
    {
        Task<RecurringInvoice?> GetByIdAsync(int id);
        Task<List<RecurringInvoice>> GetByUserIdAsync(Guid userId);
        Task<List<RecurringInvoice>> GetActiveRecurringInvoicesAsync(); // Get all active recurring invoices for processing
        Task<RecurringInvoice> AddAsync(RecurringInvoice recurringInvoice);
        Task UpdateAsync(RecurringInvoice recurringInvoice);
        Task<bool> DeleteAsync(int id);
    }
}
