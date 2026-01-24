namespace InvoiceApp.Domain.Entities
{
    public class Payment :BaseEntity
    {
        public int InvoiceId { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal WaveAmount { get; set; } = 0; // Wave off amount
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
        public string? PaymentMode { get; set; }
        public string? Remarks { get; set; }

        public Invoice? Invoice { get; set; }
    }
}