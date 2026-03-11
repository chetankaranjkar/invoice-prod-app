using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Application.Interfaces
{
    public interface IProductService
    {
        Task<List<ProductDto>> SearchProductsAsync(Guid userId, string? search, int limit = 20);
        Task<List<ProductDto>> GetAllProductsAsync(Guid userId);
        Task<ProductDto?> GetProductByIdAsync(int id, Guid userId);
        Task<ProductDto> CreateProductAsync(Guid userId, CreateProductDto dto);
        Task<ProductDto?> UpdateProductAsync(int id, Guid userId, UpdateProductDto dto);
        Task<bool> DeleteProductAsync(int id, Guid userId);
        Task UpsertProductsFromInvoiceAsync(Guid userId, IEnumerable<(string Name, decimal Rate, decimal GstPercentage)> items);
    }
}
