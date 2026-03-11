using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Interfaces
{
    public interface IProductRepository
    {
        Task<List<Product>> SearchByUserIdAsync(Guid userId, string? search, int limit = 20);
        Task<List<Product>> GetAllByUserIdAsync(Guid userId);
        Task<Product?> GetByIdAsync(int id, Guid userId);
        Task<Product?> GetByNameAsync(Guid userId, string name);
        Task<Product> AddOrUpdateAsync(Product product);
        Task<Product> AddAsync(Product product);
        Task<Product> UpdateAsync(Product product);
        Task<bool> DeleteAsync(int id, Guid userId);
    }
}
