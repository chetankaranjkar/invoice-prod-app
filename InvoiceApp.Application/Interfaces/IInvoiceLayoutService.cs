using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceLayoutService
    {
        Task<List<InvoiceLayoutConfigDto>> GetUserLayoutsAsync(Guid userId);
        Task<InvoiceLayoutConfigDto?> GetLayoutByIdAsync(int id, Guid userId);
        Task<InvoiceLayoutConfigDto?> GetDefaultLayoutAsync(Guid userId);
        Task<InvoiceLayoutConfigDto> CreateLayoutAsync(Guid userId, CreateInvoiceLayoutConfigDto createDto);
        Task<InvoiceLayoutConfigDto> UpdateLayoutAsync(int id, Guid userId, UpdateInvoiceLayoutConfigDto updateDto);
        Task<bool> DeleteLayoutAsync(int id, Guid userId);
        Task<InvoiceLayoutConfigDto> SetDefaultAsync(int id, Guid userId);
    }
}
