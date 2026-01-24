using System;
using System.Collections.Generic;

namespace InvoiceApp.Domain.Entities
{
    public class RecurringInvoice : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public int CustomerId { get; set; }
        public string Frequency { get; set; } = "Monthly"; // Daily, Weekly, Monthly, Yearly
        public int DayOfMonth { get; set; } = 1; // Day of month to generate invoice (1-31)
        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime? EndDate { get; set; } // Optional end date
        public int? NumberOfOccurrences { get; set; } // Optional: generate X times then stop
        public int GeneratedCount { get; set; } = 0; // Track how many invoices have been generated
        public bool IsActive { get; set; } = true;
        public DateTime? LastGeneratedDate { get; set; } // Last time invoice was generated
        public DateTime? NextGenerationDate { get; set; } // Next scheduled generation date
        public string? Description { get; set; }

        // Invoice template data (stored as JSON or separate table)
        public decimal? DefaultAmount { get; set; } // Optional default amount
        public decimal? DefaultGstPercentage { get; set; } // Optional default GST

        public User? User { get; set; }
        public Customer? Customer { get; set; }
        public ICollection<RecurringInvoiceItem> RecurringItems { get; set; } = new List<RecurringInvoiceItem>();
    }
}
