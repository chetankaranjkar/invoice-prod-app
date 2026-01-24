namespace InvoiceApp.Domain.Entities
{
    public class RecurringInvoiceItem : BaseEntity
    {
        public int RecurringInvoiceId { get; set; }
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal GstPercentage { get; set; }

        public RecurringInvoice? RecurringInvoice { get; set; }
    }
}
