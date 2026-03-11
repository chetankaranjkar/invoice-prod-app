namespace InvoiceApp.Application.DTOs
{
    public class ProductDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
    }

    public class CreateProductDto
    {
        public string Name { get; set; } = null!;
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
    }

    public class UpdateProductDto
    {
        public string Name { get; set; } = null!;
        public decimal? DefaultRate { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
    }
}
