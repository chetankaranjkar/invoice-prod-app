namespace InvoiceApp.Domain.Entities
{
    public class InvoiceItem : BaseEntity
    {
        public int InvoiceId { get; set; }
        public int? ProductId { get; set; }
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal Amount { get; set; }
        public decimal GstPercentage { get; set; }
        public decimal GstAmount { get; set; }
        public decimal Cgst { get; set; }
        public decimal Sgst { get; set; }

        public int? ParentInvoiceItemId { get; set; }
        public int HierarchyLevel { get; set; }
        public bool AffectTotal { get; set; } = true;
        public bool Taxable { get; set; } = true;
        public int DisplayOrder { get; set; }
        public bool ShowOnInvoice { get; set; } = true;

        public Invoice? Invoice { get; set; }
        public Product? Product { get; set; }
        public InvoiceItem? ParentInvoiceItem { get; set; }
        public ICollection<InvoiceItem> ChildItems { get; set; } = new List<InvoiceItem>();
    }
}
