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
        Task<InvoiceDto> CreateInvoiceAsync(Guid userId, CreateInvoiceDto createInvoiceDto);
        Task<List<InvoiceDto>> GetUserInvoicesAsync(Guid userId);
        Task<InvoiceDto?> GetInvoiceByIdAsync(int id, Guid userId);
        Task<bool> AddPaymentAsync(int invoiceId, Guid userId, PaymentDto paymentDto);
    }
}
