using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Domain.Entities
{
    public class Invoice:BaseEntity
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public int CustomerId { get; set; }
        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
        public DateTime? DueDate { get; set; }

        public decimal TotalAmount { get; set; }
        public decimal GstPercentage { get; set; }
        public decimal GstAmount { get; set; }
        public decimal Cgst { get; set; }
        public decimal Sgst { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; } = 0m; // Actual payment received (excluding wave)
        public decimal WaveAmount { get; set; } = 0m; // Total wave off/discount amount
        public decimal BalanceAmount { get; set; } = 0m;
        public string Status { get; set; } = "Unpaid";

        /// <summary>JSON snapshot of seller/company info at invoice creation. Ensures invoice always shows creator's details as they were when created, even if profile changes later.</summary>
        public string? SellerInfoSnapshot { get; set; }

        public User? User { get; set; }
        public Customer? Customer { get; set; }
        public ICollection<InvoiceItem> InvoiceItems { get; set; } = new List<InvoiceItem>();
        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    }
}
