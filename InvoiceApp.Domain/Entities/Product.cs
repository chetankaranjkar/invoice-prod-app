namespace InvoiceApp.Domain.Entities
{
    public class Product : BaseEntity
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = null!;
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }

        public User? User { get; set; }
    }
}
