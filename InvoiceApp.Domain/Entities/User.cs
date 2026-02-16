namespace InvoiceApp.Domain.Entities
{
    public class User : BaseEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string Role { get; set; } = "User"; // MasterUser, Admin, or User
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
        public string? LogoUrl { get; set; }  // Add this line
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public string? GpayNumber { get; set; }
        public string? TaxPractitionerTitle { get; set; } // e.g. "TAX GST PRACTITIONER" - line below company name
        public string? InvoicePrefix { get; set; } = "INV"; // Default invoice prefix
        public decimal DefaultGstPercentage { get; set; } = 18; // Default GST percentage
        public bool DisableQuantity { get; set; } = false; // Disable quantity field in invoices
        public Guid? CreatedBy { get; set; } // ID of the admin/masteruser who created this user
        public User? CreatedByNavigation { get; set; } // Navigation property to the creator
        public ICollection<Customer> Customers { get; set; } = new List<Customer>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }
}