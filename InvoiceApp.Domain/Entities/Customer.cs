using System;
using System.Collections.Generic;

namespace InvoiceApp.Domain.Entities
{
    public class Customer : BaseEntity
    {
        public Guid UserId { get; set; }
        public string CustomerName { get; set; } = null!;
        public string? GstNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? BillingAddress { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public decimal TotalBalance { get; set; } = 0m;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User? User { get; set; }
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }
}