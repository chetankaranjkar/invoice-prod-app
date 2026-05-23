using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Interfaces
{
    public interface IProductRepository
    {
        Task<List<Product>> SearchByUserIdAsync(Guid userId, string? search, int limit = 20);
        Task<List<Product>> GetAllByUserIdAsync(Guid userId);
        Task<List<Product>> GetAllWithHierarchyByUserIdAsync(Guid userId);
        Task<List<Product>> GetChildrenByParentIdAsync(int parentId, Guid userId);
        Task<Product?> GetByIdAsync(int id, Guid userId);
        Task<Product?> GetByNameAsync(Guid userId, string name);
        Task<int> CountChildrenAsync(int parentId, Guid userId);
        Task<Product> AddOrUpdateAsync(Product product);
        Task<Product> AddAsync(Product product);
        Task<Product> UpdateAsync(Product product);
        Task<bool> DeleteAsync(int id, Guid userId);
    }
}
