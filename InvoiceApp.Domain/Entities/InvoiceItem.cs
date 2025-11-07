namespace InvoiceApp.Domain.Entities
{
    public class InvoiceItem:BaseEntity
    {
        public int InvoiceId { get; set; }
        public string ProductName { get; set; } = null!;
        public int Quantity { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal Amount { get; set; }
        public decimal GstPercentage { get; set; }
        public decimal GstAmount { get; set; }
        public decimal Cgst { get; set; }
        public decimal Sgst { get; set; }

        public Invoice? Invoice { get; set; }
    }
}