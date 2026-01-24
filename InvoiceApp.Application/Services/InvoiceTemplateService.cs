using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Application.Services
{
    public class InvoiceTemplateService : IInvoiceTemplateService
    {
        private readonly IInvoiceTemplateRepository _templateRepository;
        private readonly IMapper _mapper;

        public InvoiceTemplateService(
            IInvoiceTemplateRepository templateRepository,
            IMapper mapper)
        {
            _templateRepository = templateRepository;
            _mapper = mapper;
        }

        public async Task<InvoiceTemplateDto> CreateTemplateAsync(Guid userId, CreateInvoiceTemplateDto createTemplateDto)
        {
            // Check if template name already exists for this user
            var existingTemplates = await _templateRepository.GetByUserIdAsync(userId);
            if (existingTemplates.Any(t => t.TemplateName.Equals(createTemplateDto.TemplateName, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"A template with the name '{createTemplateDto.TemplateName}' already exists.");
            }

            var template = new InvoiceTemplate
            {
                TemplateName = createTemplateDto.TemplateName,
                Description = createTemplateDto.Description,
                UserId = userId,
                TemplateItems = createTemplateDto.Items.Select(item => new InvoiceTemplateItem
                {
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    Rate = item.Rate,
                    GstPercentage = item.GstPercentage
                }).ToList()
            };

            var createdTemplate = await _templateRepository.AddAsync(template);
            return _mapper.Map<InvoiceTemplateDto>(createdTemplate);
        }

        public async Task<InvoiceTemplateDto> UpdateTemplateAsync(int templateId, Guid userId, UpdateInvoiceTemplateDto updateTemplateDto)
        {
            var template = await _templateRepository.GetByIdAsync(templateId);
            if (template == null)
                throw new ArgumentException("Template not found");

            if (template.UserId != userId)
                throw new UnauthorizedAccessException("You don't have permission to update this template");

            // Check if new name conflicts with another template
            var existingTemplates = await _templateRepository.GetByUserIdAsync(userId);
            if (existingTemplates.Any(t => t.Id != templateId && t.TemplateName.Equals(updateTemplateDto.TemplateName, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"A template with the name '{updateTemplateDto.TemplateName}' already exists.");
            }

            template.TemplateName = updateTemplateDto.TemplateName;
            template.Description = updateTemplateDto.Description;
            template.UpdatedAt = DateTime.UtcNow;

            // Remove old items
            template.TemplateItems.Clear();

            // Add new items
            foreach (var itemDto in updateTemplateDto.Items)
            {
                template.TemplateItems.Add(new InvoiceTemplateItem
                {
                    ProductName = itemDto.ProductName,
                    Quantity = itemDto.Quantity,
                    Rate = itemDto.Rate,
                    GstPercentage = itemDto.GstPercentage
                });
            }

            await _templateRepository.UpdateAsync(template);
            return _mapper.Map<InvoiceTemplateDto>(template);
        }

        public async Task<bool> DeleteTemplateAsync(int templateId, Guid userId)
        {
            var template = await _templateRepository.GetByIdAsync(templateId);
            if (template == null)
                return false;

            if (template.UserId != userId)
                return false;

            return await _templateRepository.DeleteAsync(templateId);
        }

        public async Task<List<InvoiceTemplateDto>> GetUserTemplatesAsync(Guid userId)
        {
            var templates = await _templateRepository.GetByUserIdAsync(userId);
            return _mapper.Map<List<InvoiceTemplateDto>>(templates);
        }

        public async Task<InvoiceTemplateDto?> GetTemplateByIdAsync(int templateId, Guid userId)
        {
            var template = await _templateRepository.GetByIdAsync(templateId);
            if (template == null)
                return null;

            if (template.UserId != userId)
                return null;

            return _mapper.Map<InvoiceTemplateDto>(template);
        }
    }
}
