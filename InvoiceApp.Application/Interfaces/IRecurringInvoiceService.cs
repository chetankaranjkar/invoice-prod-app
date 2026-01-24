using InvoiceApp.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IRecurringInvoiceService
    {
        Task<RecurringInvoiceDto> CreateRecurringInvoiceAsync(Guid userId, CreateRecurringInvoiceDto createDto);
        Task<RecurringInvoiceDto> UpdateRecurringInvoiceAsync(int id, Guid userId, UpdateRecurringInvoiceDto updateDto);
        Task<bool> DeleteRecurringInvoiceAsync(int id, Guid userId);
        Task<List<RecurringInvoiceDto>> GetUserRecurringInvoicesAsync(Guid userId);
        Task<RecurringInvoiceDto?> GetRecurringInvoiceByIdAsync(int id, Guid userId);
        Task<List<InvoiceDto>> GenerateInvoicesFromRecurringAsync(); // Process all due recurring invoices
        Task<InvoiceDto> GenerateInvoiceFromRecurringAsync(int recurringInvoiceId, Guid userId); // Manually generate one
    }
}
