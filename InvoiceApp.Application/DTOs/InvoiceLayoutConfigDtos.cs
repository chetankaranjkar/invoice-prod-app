using System;
using System.Text.Json;

namespace InvoiceApp.Application.DTOs
{
    public class InvoiceLayoutConfigDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public JsonElement Config { get; set; }
        public string? ConfigJson { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateInvoiceLayoutConfigDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public JsonElement Config { get; set; }
        public string? ConfigJson { get; set; }
        public bool IsDefault { get; set; }
    }

    public class UpdateInvoiceLayoutConfigDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public JsonElement Config { get; set; }
        public string? ConfigJson { get; set; }
        public bool IsDefault { get; set; }
    }
}
