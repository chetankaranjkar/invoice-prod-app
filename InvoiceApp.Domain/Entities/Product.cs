using InvoiceApp.Domain.Enums;

namespace InvoiceApp.Domain.Entities
{
    public class Product : BaseEntity
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = null!;
        public ProductType ProductType { get; set; } = ProductType.Parent;
        public int? ParentProductId { get; set; }
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
        public bool AffectTotal { get; set; } = true;
        public bool Taxable { get; set; } = true;
        public bool InheritGstFromParent { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        public int DisplayOrder { get; set; }

        public User? User { get; set; }
        public Product? ParentProduct { get; set; }
        public ICollection<Product> SubProducts { get; set; } = new List<Product>();
    }
}
