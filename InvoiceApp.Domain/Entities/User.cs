namespace InvoiceApp.Domain.Entities
{
    public class User : BaseEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? LogoUrl { get; set; }  // Add this line
        public ICollection<Customer> Customers { get; set; } = new List<Customer>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }
}