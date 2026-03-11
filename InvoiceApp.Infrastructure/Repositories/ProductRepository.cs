using Microsoft.EntityFrameworkCore;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Infrastructure.Data;

namespace InvoiceApp.Infrastructure.Repositories
{
    public class ProductRepository : IProductRepository
    {
        private readonly AppDbContext _context;

        public ProductRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Product>> SearchByUserIdAsync(Guid userId, string? search, int limit = 20)
        {
            var query = _context.Products
                .AsNoTracking()
                .Where(p => p.UserId == userId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(p => p.Name.ToLower().Contains(term));
            }

            return await query
                .OrderBy(p => p.Name)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<Product?> GetByNameAsync(Guid userId, string name)
        {
            var normalized = name.Trim();
            if (string.IsNullOrEmpty(normalized)) return null;
            return await _context.Products
                .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == normalized);
        }

        public async Task<List<Product>> GetAllByUserIdAsync(Guid userId)
        {
            return await _context.Products
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.Name)
                .ToListAsync();
        }

        public async Task<Product?> GetByIdAsync(int id, Guid userId)
        {
            return await _context.Products
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        }

        public async Task<Product> AddOrUpdateAsync(Product product)
        {
            var existing = await _context.Products
                .FirstOrDefaultAsync(p => p.UserId == product.UserId && p.Name == product.Name);

            if (existing != null)
            {
                existing.DefaultRate = product.DefaultRate ?? existing.DefaultRate;
                existing.DefaultGstPercentage = product.DefaultGstPercentage ?? existing.DefaultGstPercentage;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return existing;
            }

            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            return product;
        }

        public async Task<Product> AddAsync(Product product)
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            return product;
        }

        public async Task<Product> UpdateAsync(Product product)
        {
            product.UpdatedAt = DateTime.UtcNow;
            _context.Products.Update(product);
            await _context.SaveChangesAsync();
            return product;
        }

        public async Task<bool> DeleteAsync(int id, Guid userId)
        {
            var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (product == null) return false;
            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
