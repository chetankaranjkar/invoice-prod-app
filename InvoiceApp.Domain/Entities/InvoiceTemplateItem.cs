namespace InvoiceApp.Domain.Entities
{
    public class InvoiceTemplateItem : BaseEntity
    {
        public int TemplateId { get; set; }
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal GstPercentage { get; set; }

        public InvoiceTemplate? Template { get; set; }
    }
}
