using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Services
{
    public class InvoiceLayoutService : IInvoiceLayoutService
    {
        private readonly IInvoiceLayoutRepository _layoutRepository;

        public InvoiceLayoutService(IInvoiceLayoutRepository layoutRepository)
        {
            _layoutRepository = layoutRepository;
        }

        public async Task<List<InvoiceLayoutConfigDto>> GetUserLayoutsAsync(Guid userId)
        {
            var layouts = await _layoutRepository.GetByUserIdAsync(userId);
            return layouts.Select(MapToDto).ToList();
        }

        public async Task<InvoiceLayoutConfigDto?> GetLayoutByIdAsync(int id, Guid userId)
        {
            var layout = await _layoutRepository.GetByIdAsync(id);
            if (layout == null || layout.UserId != userId)
                return null;

            return MapToDto(layout);
        }

        public async Task<InvoiceLayoutConfigDto?> GetDefaultLayoutAsync(Guid userId)
        {
            var layout = await _layoutRepository.GetDefaultAsync(userId);
            return layout == null ? null : MapToDto(layout);
        }

        public async Task<InvoiceLayoutConfigDto> CreateLayoutAsync(Guid userId, CreateInvoiceLayoutConfigDto createDto)
        {
            var configJson = ResolveConfigJson(createDto.Config, createDto.ConfigJson);
            if (string.IsNullOrWhiteSpace(configJson))
                throw new InvalidOperationException("Layout config is required.");

            var existing = await _layoutRepository.GetByUserIdAsync(userId);
            if (existing.Any(l => l.Name.Equals(createDto.Name, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("A layout with the same name already exists.");

            if (createDto.IsDefault)
                await _layoutRepository.ClearDefaultAsync(userId);

            var layout = new InvoiceLayoutConfig
            {
                UserId = userId,
                Name = createDto.Name.Trim(),
                Description = createDto.Description?.Trim(),
                ConfigJson = configJson,
                IsDefault = createDto.IsDefault,
                CreatedAt = DateTime.UtcNow
            };

            var created = await _layoutRepository.AddAsync(layout);
            return MapToDto(created);
        }

        public async Task<InvoiceLayoutConfigDto> UpdateLayoutAsync(int id, Guid userId, UpdateInvoiceLayoutConfigDto updateDto)
        {
            var configJson = ResolveConfigJson(updateDto.Config, updateDto.ConfigJson);
            if (string.IsNullOrWhiteSpace(configJson))
                throw new InvalidOperationException("Layout config is required.");

            var layout = await _layoutRepository.GetByIdAsync(id);
            if (layout == null)
                throw new ArgumentException("Layout not found.");

            if (layout.UserId != userId)
                throw new UnauthorizedAccessException("Not allowed to update this layout.");

            var existing = await _layoutRepository.GetByUserIdAsync(userId);
            if (existing.Any(l => l.Id != id && l.Name.Equals(updateDto.Name, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("A layout with the same name already exists.");

            if (updateDto.IsDefault)
                await _layoutRepository.ClearDefaultAsync(userId);

            layout.Name = updateDto.Name.Trim();
            layout.Description = updateDto.Description?.Trim();
            layout.ConfigJson = configJson;
            layout.IsDefault = updateDto.IsDefault;
            layout.UpdatedAt = DateTime.UtcNow;

            await _layoutRepository.UpdateAsync(layout);
            return MapToDto(layout);
        }

        public async Task<bool> DeleteLayoutAsync(int id, Guid userId)
        {
            var layout = await _layoutRepository.GetByIdAsync(id);
            if (layout == null || layout.UserId != userId)
                return false;

            return await _layoutRepository.DeleteAsync(id);
        }

        public async Task<InvoiceLayoutConfigDto> SetDefaultAsync(int id, Guid userId)
        {
            var layout = await _layoutRepository.GetByIdAsync(id);
            if (layout == null)
                throw new ArgumentException("Layout not found.");

            if (layout.UserId != userId)
                throw new UnauthorizedAccessException("Not allowed to update this layout.");

            await _layoutRepository.ClearDefaultAsync(userId);
            layout.IsDefault = true;
            layout.UpdatedAt = DateTime.UtcNow;
            await _layoutRepository.UpdateAsync(layout);

            return MapToDto(layout);
        }

        private static InvoiceLayoutConfigDto MapToDto(InvoiceLayoutConfig layout)
        {
            using var document = JsonDocument.Parse(layout.ConfigJson);
            return new InvoiceLayoutConfigDto
            {
                Id = layout.Id,
                Name = layout.Name,
                Description = layout.Description,
                Config = document.RootElement.Clone(),
                ConfigJson = layout.ConfigJson,
                IsDefault = layout.IsDefault,
                CreatedAt = layout.CreatedAt,
                UpdatedAt = layout.UpdatedAt
            };
        }

        private static string? ResolveConfigJson(JsonElement configElement, string? configJson)
        {
            if (!string.IsNullOrWhiteSpace(configJson))
            {
                try
                {
                    using var document = JsonDocument.Parse(configJson);
                    return document.RootElement.GetRawText();
                }
                catch (JsonException)
                {
                    throw new InvalidOperationException("Layout config JSON is invalid.");
                }
            }

            if (configElement.ValueKind == JsonValueKind.Undefined || configElement.ValueKind == JsonValueKind.Null)
                return null;

            return JsonSerializer.Serialize(configElement);
        }
    }
}
