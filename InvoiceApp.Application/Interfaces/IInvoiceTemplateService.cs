using InvoiceApp.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface IInvoiceTemplateService
    {
        Task<InvoiceTemplateDto> CreateTemplateAsync(Guid userId, CreateInvoiceTemplateDto createTemplateDto);
        Task<InvoiceTemplateDto> UpdateTemplateAsync(int templateId, Guid userId, UpdateInvoiceTemplateDto updateTemplateDto);
        Task<bool> DeleteTemplateAsync(int templateId, Guid userId);
        Task<List<InvoiceTemplateDto>> GetUserTemplatesAsync(Guid userId);
        Task<InvoiceTemplateDto?> GetTemplateByIdAsync(int templateId, Guid userId);
    }
}
