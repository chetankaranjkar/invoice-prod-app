namespace InvoiceApp.Application.DTOs
{
    public class ProductDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string ProductType { get; set; } = "parent";
        public int? ParentProductId { get; set; }
        public string? ParentProductName { get; set; }
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
        public bool AffectTotal { get; set; } = true;
        public bool Taxable { get; set; } = true;
        public bool InheritGstFromParent { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        public int DisplayOrder { get; set; }
        public List<ProductDto> Children { get; set; } = new();
    }

    public class ReorderProductItemDto
    {
        public int Id { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class CreateProductDto
    {
        public string Name { get; set; } = null!;
        public string ProductType { get; set; } = "parent";
        public int? ParentProductId { get; set; }
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
        public bool? AffectTotal { get; set; }
        public bool? Taxable { get; set; }
        public bool? InheritGstFromParent { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        public int DisplayOrder { get; set; }
    }

    public class UpdateProductDto : CreateProductDto
    {
    }
}
