using InvoiceApp.Domain.Entities;
using InvoiceApp.Domain.Enums;
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

        private static ProductDto ToDto(Product p, IReadOnlyDictionary<int, string>? parentNames = null) => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            ProductType = ProductHierarchyValidator.ToApiType(p.ProductType),
            ParentProductId = p.ParentProductId,
            ParentProductName = p.ParentProductId.HasValue && parentNames != null && parentNames.TryGetValue(p.ParentProductId.Value, out var pn) ? pn : null,
            DefaultRate = p.DefaultRate,
            DefaultGstPercentage = p.DefaultGstPercentage,
            AffectTotal = p.AffectTotal,
            Taxable = p.Taxable,
            InheritGstFromParent = p.InheritGstFromParent,
            Description = p.Description,
            IsActive = p.IsActive
        };

        public async Task<List<ProductDto>> SearchProductsAsync(Guid userId, string? search, int limit = 20)
        {
            var products = await _productRepository.SearchByUserIdAsync(userId, search, limit);
            return products.Where(p => p.IsActive).Select(p => ToDto(p)).ToList();
        }

        public async Task<List<ProductDto>> GetAllProductsAsync(Guid userId)
        {
            var products = await _productRepository.GetAllByUserIdAsync(userId);
            var parentNames = products.ToDictionary(p => p.Id, p => p.Name);
            return products.Select(p => ToDto(p, parentNames)).ToList();
        }

        public async Task<List<ProductDto>> GetProductTreeAsync(Guid userId)
        {
            var products = await _productRepository.GetAllWithHierarchyByUserIdAsync(userId);
            var parentNames = products.ToDictionary(p => p.Id, p => p.Name);
            var parents = products
                .Where(p => p.ProductType == ProductType.Parent)
                .Select(p =>
                {
                    var dto = ToDto(p, parentNames);
                    dto.Children = products
                        .Where(c => c.ParentProductId == p.Id)
                        .Select(c => ToDto(c, parentNames))
                        .OrderBy(c => c.Name)
                        .ToList();
                    return dto;
                })
                .OrderBy(p => p.Name)
                .ToList();

            return parents;
        }

        public async Task<List<ProductDto>> GetSubProductsAsync(int parentProductId, Guid userId)
        {
            var children = await _productRepository.GetChildrenByParentIdAsync(parentProductId, userId);
            return children.Select(p => ToDto(p)).ToList();
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

            var productType = ProductHierarchyValidator.ParseProductType(dto.ProductType);
            var allProducts = await _productRepository.GetAllByUserIdAsync(userId);
            ProductHierarchyValidator.ValidateProduct(productType, dto.ParentProductId, allProducts);

            var existing = await _productRepository.GetByNameAsync(userId, name);
            if (existing != null)
                throw new InvalidOperationException($"Product '{name}' already exists.");

            var isSub = productType == ProductType.Sub;
            var product = new Product
            {
                UserId = userId,
                Name = name,
                ProductType = productType,
                ParentProductId = isSub ? dto.ParentProductId : null,
                DefaultRate = dto.DefaultRate,
                DefaultGstPercentage = dto.DefaultGstPercentage,
                AffectTotal = dto.AffectTotal ?? !isSub,
                Taxable = dto.Taxable ?? true,
                InheritGstFromParent = dto.InheritGstFromParent ?? false,
                Description = dto.Description?.Trim(),
                IsActive = dto.IsActive
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

            var productType = ProductHierarchyValidator.ParseProductType(dto.ProductType);
            var allProducts = await _productRepository.GetAllByUserIdAsync(userId);
            ProductHierarchyValidator.ValidateProduct(productType, dto.ParentProductId, allProducts, id);

            var sameName = await _productRepository.GetByNameAsync(userId, name);
            if (sameName != null && sameName.Id != id)
                throw new InvalidOperationException($"Product '{name}' already exists.");

            if (productType == ProductType.Parent)
            {
                var childCount = await _productRepository.CountChildrenAsync(id, userId);
                if (childCount > 0 && dto.ParentProductId.HasValue)
                    throw new InvalidOperationException("Parent products with sub-products cannot become sub-products.");
            }

            var isSub = productType == ProductType.Sub;
            product.Name = name;
            product.ProductType = productType;
            product.ParentProductId = isSub ? dto.ParentProductId : null;
            product.DefaultRate = dto.DefaultRate;
            product.DefaultGstPercentage = dto.DefaultGstPercentage;
            product.AffectTotal = dto.AffectTotal ?? !isSub;
            product.Taxable = dto.Taxable ?? true;
            product.InheritGstFromParent = dto.InheritGstFromParent ?? false;
            product.Description = dto.Description?.Trim();
            product.IsActive = dto.IsActive;

            var updated = await _productRepository.UpdateAsync(product);
            return ToDto(updated);
        }

        public async Task<bool> DeleteProductAsync(int id, Guid userId)
        {
            var childCount = await _productRepository.CountChildrenAsync(id, userId);
            if (childCount > 0)
                throw new InvalidOperationException("Cannot delete a parent product that has sub-products. Delete or reassign sub-products first.");

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
                    ProductType = ProductType.Parent,
                    DefaultRate = rate,
                    DefaultGstPercentage = gstPercentage,
                    AffectTotal = true,
                    Taxable = true,
                    IsActive = true
                });
            }
        }
    }
}
