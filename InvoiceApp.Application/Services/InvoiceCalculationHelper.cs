using InvoiceApp.Application.DTOs;
using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Services
{
    public static class InvoiceCalculationHelper
    {
        public const int MoneyDecimals = 2;

        public static decimal RoundMoney(decimal value) =>
            Math.Round(value, MoneyDecimals, MidpointRounding.AwayFromZero);

        public static (decimal Amount, decimal GstAmount, decimal Cgst, decimal Sgst) CalculateLineAmounts(
            int quantity,
            decimal rate,
            decimal gstPercentage,
            bool taxable,
            bool affectTotal)
        {
            var amount = RoundMoney(quantity * rate);
            if (!affectTotal || !taxable || gstPercentage <= 0)
            {
                return (amount, 0, 0, 0);
            }

            var gstAmount = RoundMoney(amount * (gstPercentage / 100m));
            var half = RoundMoney(gstAmount / 2m);
            return (amount, gstAmount, half, half);
        }

        public static InvoiceTotalsResult CalculateInvoiceTotals(IEnumerable<InvoiceItemDto> items)
        {
            var ordered = items
                .Select((dto, index) => (dto, index))
                .OrderBy(x => x.dto.DisplayOrder)
                .ThenBy(x => x.index)
                .Select(x => x.dto)
                .ToList();

            decimal totalAmount = 0;
            decimal totalGst = 0;

            foreach (var item in ordered)
            {
                var (_, gstAmount, _, _) = CalculateLineAmounts(
                    item.Quantity,
                    item.Rate,
                    item.GstPercentage,
                    item.Taxable,
                    item.AffectTotal);

                if (item.AffectTotal)
                {
                    totalAmount += RoundMoney(item.Quantity * item.Rate);
                    totalGst += gstAmount;
                }
            }

            totalAmount = RoundMoney(totalAmount);
            totalGst = RoundMoney(totalGst);
            var cgst = RoundMoney(totalGst / 2m);
            var sgst = RoundMoney(totalGst - cgst);

            return new InvoiceTotalsResult
            {
                TotalAmount = totalAmount,
                GstAmount = totalGst,
                Cgst = cgst,
                Sgst = sgst,
                GrandTotal = RoundMoney(totalAmount + totalGst)
            };
        }

        public static List<InvoiceItem> BuildInvoiceItems(IEnumerable<InvoiceItemDto> itemDtos)
        {
            var ordered = itemDtos
                .Select((dto, index) => (dto, index))
                .OrderBy(x => x.dto.DisplayOrder)
                .ThenBy(x => x.index)
                .Select(x => x.dto)
                .ToList();

            var lineKeyToEntity = new Dictionary<string, InvoiceItem>(StringComparer.Ordinal);
            var entities = new List<InvoiceItem>();
            var parents = ordered.Where(i => string.IsNullOrWhiteSpace(i.ParentLineKey)).ToList();
            var children = ordered.Where(i => !string.IsNullOrWhiteSpace(i.ParentLineKey)).ToList();

            foreach (var dto in parents)
            {
                var entity = CreateEntity(dto, null, entities.Count);
                entities.Add(entity);
                if (!string.IsNullOrWhiteSpace(dto.LineKey))
                    lineKeyToEntity[dto.LineKey] = entity;
            }

            foreach (var dto in children)
            {
                InvoiceItem? parentEntity = null;
                if (!string.IsNullOrWhiteSpace(dto.ParentLineKey))
                    lineKeyToEntity.TryGetValue(dto.ParentLineKey, out parentEntity);

                var entity = CreateEntity(dto, parentEntity?.Id, entities.Count);
                if (parentEntity != null)
                    entity.ParentInvoiceItem = parentEntity;
                entities.Add(entity);
            }

            return entities;
        }

        private static InvoiceItem CreateEntity(InvoiceItemDto dto, int? parentInvoiceItemId, int displayOrder)
        {
            var (amount, gstAmount, cgst, sgst) = CalculateLineAmounts(
                dto.Quantity,
                dto.Rate,
                dto.GstPercentage,
                dto.Taxable,
                dto.AffectTotal);

            return new InvoiceItem
            {
                ProductId = dto.ProductId,
                ProductName = dto.ProductName,
                Quantity = dto.Quantity,
                Rate = dto.Rate,
                Amount = amount,
                GstPercentage = dto.GstPercentage,
                GstAmount = gstAmount,
                Cgst = cgst,
                Sgst = sgst,
                ParentInvoiceItemId = parentInvoiceItemId,
                HierarchyLevel = dto.HierarchyLevel,
                AffectTotal = dto.AffectTotal,
                Taxable = dto.Taxable,
                DisplayOrder = dto.DisplayOrder > 0 ? dto.DisplayOrder : displayOrder,
                ShowOnInvoice = dto.ShowOnInvoice
            };
        }
    }

    public class InvoiceTotalsResult
    {
        public decimal TotalAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal Cgst { get; set; }
        public decimal Sgst { get; set; }
        public decimal GrandTotal { get; set; }
    }
}
