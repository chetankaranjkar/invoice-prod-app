using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Application.DTOs
{
    public class CustomerDto
    {
        public int Id { get; set; }
        public string CustomerName { get; set; } = null!;
        public string? GstNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? BillingAddress { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public decimal TotalBalance { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
