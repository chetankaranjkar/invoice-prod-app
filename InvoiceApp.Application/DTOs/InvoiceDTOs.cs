using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Application.DTOs
{
    public class InvoiceItemDto
    {
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal GstPercentage { get; set; }
    }

    public class CreateInvoiceDto
    {
        public int CustomerId { get; set; }
        public DateTime? DueDate { get; set; }
        public string InvoicePrefix { get; set; } = "INV";
        public List<InvoiceItemDto> Items { get; set; } = new();
        public string Status { get; set; } = "Unpaid";
        public decimal InitialPayment { get; set; } = 0;
    }

    public class UpdateInvoiceDto
    {
        public int CustomerId { get; set; }
        public DateTime? DueDate { get; set; }
        public List<InvoiceItemDto> Items { get; set; } = new();
        public string Status { get; set; } = "Unpaid";
    }

    public class InvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public string? UserName { get; set; } // Name of the user who created the invoice (for admin view)
        public DateTime InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; } // Actual payment received (excluding wave)
        public decimal WaveAmount { get; set; } = 0; // Total wave off/discount amount
        public decimal BalanceAmount { get; set; }
        public string Status { get; set; } = "Unpaid";
        public List<InvoiceItemDto> Items { get; set; } = new();
        public List<PaymentDto> Payments { get; set; } = new();
    }

    public class PaymentDto
    {
        public decimal AmountPaid { get; set; }
        public decimal WaveAmount { get; set; } = 0; // Wave off amount
        public string? PaymentMode { get; set; }
        public string? Remarks { get; set; }
    }
}
