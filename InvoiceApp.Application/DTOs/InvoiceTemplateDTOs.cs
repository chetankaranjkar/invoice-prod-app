using System;
using System.Collections.Generic;

namespace InvoiceApp.Application.DTOs
{
    public class InvoiceTemplateItemDto
    {
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal GstPercentage { get; set; }
    }

    public class CreateInvoiceTemplateDto
    {
        public string TemplateName { get; set; } = null!;
        public string? Description { get; set; }
        public List<InvoiceTemplateItemDto> Items { get; set; } = new();
    }

    public class UpdateInvoiceTemplateDto
    {
        public string TemplateName { get; set; } = null!;
        public string? Description { get; set; }
        public List<InvoiceTemplateItemDto> Items { get; set; } = new();
    }

    public class InvoiceTemplateDto
    {
        public int Id { get; set; }
        public string TemplateName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<InvoiceTemplateItemDto> Items { get; set; } = new();
    }
}
