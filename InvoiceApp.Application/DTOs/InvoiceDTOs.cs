using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

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
        /// <summary>Optional. When provided, use this invoice number (must be unique per user). Otherwise auto-generate.</summary>
        [JsonProperty("invoiceNumber")]
        public string? InvoiceNumber { get; set; }
        /// <summary>Optional. Invoice created date (YYYY-MM-DD). Defaults to today when not provided. Allows backdating.</summary>
        [JsonProperty("invoiceDate")]
        public string? InvoiceDate { get; set; }
        public string InvoicePrefix { get; set; } = "INV";
        public List<InvoiceItemDto> Items { get; set; } = new();
        public string Status { get; set; } = "Unpaid";
        public decimal InitialPayment { get; set; } = 0;
        /// <summary>For Admin: create invoice on behalf of this user. Invoice will use their company info.</summary>
        public Guid? OnBehalfOfUserId { get; set; }
    }

    public class UpdateInvoiceDto
    {
        public int CustomerId { get; set; }
        public DateTime? DueDate { get; set; }
        public List<InvoiceItemDto> Items { get; set; } = new();
        public string Status { get; set; } = "Unpaid";
    }

    /// <summary>
    /// Company/seller info of the user who created the invoice.
    /// When admin views another user's invoice, this shows the creator's company details (not admin's).
    /// </summary>
    public class InvoiceSellerInfoDto
    {
        public string Name { get; set; } = null!;
        public string? Email { get; set; }
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? MembershipNo { get; set; }
        public string? GstpNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? LogoUrl { get; set; }
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public int? InvoiceHeaderFontSize { get; set; }
        public int? AddressSectionFontSize { get; set; }
        public bool? UseDefaultInvoiceFontSizes { get; set; }
        public string? GpayNumber { get; set; }
        public string? TaxPractitionerTitle { get; set; }
    }

    public class InvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public Guid? UserId { get; set; } // User who created the invoice (for admin to filter own vs team)
        public string? UserName { get; set; } // Name of the user who created the invoice (for admin view)
        /// <summary>Company details of the user who created the invoice. Used when admin views another user's invoice.</summary>
        public InvoiceSellerInfoDto? SellerInfo { get; set; }
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
