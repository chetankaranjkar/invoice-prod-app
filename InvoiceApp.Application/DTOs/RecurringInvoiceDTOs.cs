using System;
using System.Collections.Generic;

namespace InvoiceApp.Application.DTOs
{
    public class RecurringInvoiceItemDto
    {
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal GstPercentage { get; set; }
    }

    public class CreateRecurringInvoiceDto
    {
        public string Name { get; set; } = null!;
        public int CustomerId { get; set; }
        public string Frequency { get; set; } = "Monthly"; // Daily, Weekly, Monthly, Yearly
        public int DayOfMonth { get; set; } = 1;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? NumberOfOccurrences { get; set; }
        public string? Description { get; set; }
        public List<RecurringInvoiceItemDto> Items { get; set; } = new();
    }

    public class UpdateRecurringInvoiceDto
    {
        public string Name { get; set; } = null!;
        public int CustomerId { get; set; }
        public string Frequency { get; set; } = "Monthly";
        public int DayOfMonth { get; set; } = 1;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? NumberOfOccurrences { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Description { get; set; }
        public List<RecurringInvoiceItemDto> Items { get; set; } = new();
    }

    public class RecurringInvoiceDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string Frequency { get; set; } = "Monthly";
        public int DayOfMonth { get; set; } = 1;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? NumberOfOccurrences { get; set; }
        public int GeneratedCount { get; set; } = 0;
        public bool IsActive { get; set; } = true;
        public DateTime? LastGeneratedDate { get; set; }
        public DateTime? NextGenerationDate { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<RecurringInvoiceItemDto> Items { get; set; } = new();
    }
}
