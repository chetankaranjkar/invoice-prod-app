using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Application.Services
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;

        public ProductService(IProductRepository productRepository)
        {
            _productRepository = productRepository;
        }

        private static ProductDto ToDto(Product p) => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            DefaultRate = p.DefaultRate,
            DefaultGstPercentage = p.DefaultGstPercentage
        };

        public async Task<List<ProductDto>> SearchProductsAsync(Guid userId, string? search, int limit = 20)
        {
            var products = await _productRepository.SearchByUserIdAsync(userId, search, limit);
            return products.Select(ToDto).ToList();
        }

        public async Task<List<ProductDto>> GetAllProductsAsync(Guid userId)
        {
            var products = await _productRepository.GetAllByUserIdAsync(userId);
            return products.Select(ToDto).ToList();
        }

        public async Task<ProductDto?> GetProductByIdAsync(int id, Guid userId)
        {
            var product = await _productRepository.GetByIdAsync(id, userId);
            return product == null ? null : ToDto(product);
        }

        public async Task<ProductDto> CreateProductAsync(Guid userId, CreateProductDto dto)
        {
            var name = (dto.Name ?? "").Trim();
            if (string.IsNullOrEmpty(name))
                throw new ArgumentException("Product name is required.");

            var existing = await _productRepository.GetByNameAsync(userId, name);
            if (existing != null)
                throw new InvalidOperationException($"Product '{name}' already exists.");

            var product = new Product
            {
                UserId = userId,
                Name = name,
                DefaultRate = dto.DefaultRate,
                DefaultGstPercentage = dto.DefaultGstPercentage
            };
            var created = await _productRepository.AddAsync(product);
            return ToDto(created);
        }

        public async Task<ProductDto?> UpdateProductAsync(int id, Guid userId, UpdateProductDto dto)
        {
            var product = await _productRepository.GetByIdAsync(id, userId);
            if (product == null) return null;

            var name = (dto.Name ?? "").Trim();
            if (string.IsNullOrEmpty(name))
                throw new ArgumentException("Product name is required.");

            var sameName = await _productRepository.GetByNameAsync(userId, name);
            if (sameName != null && sameName.Id != id)
                throw new InvalidOperationException($"Product '{name}' already exists.");

            product.Name = name;
            product.DefaultRate = dto.DefaultRate;
            product.DefaultGstPercentage = dto.DefaultGstPercentage;
            var updated = await _productRepository.UpdateAsync(product);
            return ToDto(updated);
        }

        public async Task<bool> DeleteProductAsync(int id, Guid userId)
        {
            return await _productRepository.DeleteAsync(id, userId);
        }

        public async Task UpsertProductsFromInvoiceAsync(Guid userId, IEnumerable<(string Name, decimal Rate, decimal GstPercentage)> items)
        {
            foreach (var (name, rate, gstPercentage) in items)
            {
                var trimmed = name?.Trim();
                if (string.IsNullOrEmpty(trimmed)) continue;

                await _productRepository.AddOrUpdateAsync(new Product
                {
                    UserId = userId,
                    Name = trimmed,
                    DefaultRate = rate,
                    DefaultGstPercentage = gstPercentage
                });
            }
        }
    }
}
