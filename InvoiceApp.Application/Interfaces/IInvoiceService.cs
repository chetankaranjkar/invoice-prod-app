using InvoiceApp.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceService
    {
        Task<InvoiceDto> CreateInvoiceAsync(Guid userId, CreateInvoiceDto createInvoiceDto, string? userRole = null);
        Task<InvoiceDto> UpdateInvoiceAsync(int invoiceId, Guid userId, UpdateInvoiceDto updateInvoiceDto, string? userRole = null);
        Task<bool> DeleteInvoiceAsync(int invoiceId, Guid userId, string? userRole = null);
        Task<InvoiceDto> DuplicateInvoiceAsync(int invoiceId, Guid userId, string? userRole = null);
        Task<List<InvoiceDto>> GetUserInvoicesAsync(Guid userId);
        Task<List<InvoiceDto>> GetAdminInvoicesAsync(Guid adminId); // Get invoices from all users created by admin
        Task<List<InvoiceDto>> GetAllInvoicesAsync(); // Get all invoices (for MasterUser)
        Task<InvoiceDto?> GetInvoiceByIdAsync(int id, Guid userId, string? userRole = null);
        Task<bool> AddPaymentAsync(int invoiceId, Guid userId, PaymentDto paymentDto, string? userRole = null);
    }
}
