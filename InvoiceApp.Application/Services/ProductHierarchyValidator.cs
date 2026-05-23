using InvoiceApp.Domain.Entities;
using InvoiceApp.Domain.Enums;

namespace InvoiceApp.Application.Services
{
    public static class ProductHierarchyValidator
    {
        public static ProductType ParseProductType(string? value) =>
            string.Equals(value, "sub", StringComparison.OrdinalIgnoreCase)
                ? ProductType.Sub
                : ProductType.Parent;

        public static string ToApiType(ProductType type) =>
            type == ProductType.Sub ? "sub" : "parent";

        public static void ValidateProduct(
            ProductType productType,
            int? parentProductId,
            IReadOnlyList<Product> allUserProducts,
            int? editingProductId = null)
        {
            if (productType == ProductType.Parent && parentProductId.HasValue)
                throw new ArgumentException("Parent products cannot have a parent product.");

            if (productType == ProductType.Sub && !parentProductId.HasValue)
                throw new ArgumentException("Sub products must have a parent product selected.");

            if (!parentProductId.HasValue)
                return;

            var parent = allUserProducts.FirstOrDefault(p => p.Id == parentProductId.Value);
            if (parent == null)
                throw new ArgumentException("Parent product not found.");

            if (parent.ProductType != ProductType.Parent)
                throw new ArgumentException("Selected parent must be a parent product, not a sub product.");

            if (editingProductId.HasValue && parentProductId.Value == editingProductId.Value)
                throw new ArgumentException("A product cannot be its own parent.");

            if (editingProductId.HasValue &&
                CreatesCycle(allUserProducts, editingProductId.Value, parentProductId.Value))
            {
                throw new InvalidOperationException("Cannot assign parent: this would create a circular reference.");
            }
        }

        public static bool CreatesCycle(IReadOnlyList<Product> products, int productId, int newParentId)
        {
            var parentById = products.ToDictionary(p => p.Id);
            var current = newParentId;
            var visited = new HashSet<int>();

            while (parentById.TryGetValue(current, out var node))
            {
                if (current == productId)
                    return true;
                if (!visited.Add(current))
                    return true;
                if (!node.ParentProductId.HasValue)
                    break;
                current = node.ParentProductId.Value;
            }

            return current == productId;
        }
    }
}
