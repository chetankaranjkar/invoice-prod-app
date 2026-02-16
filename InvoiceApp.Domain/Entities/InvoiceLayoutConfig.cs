using System;

namespace InvoiceApp.Domain.Entities
{
    public class InvoiceLayoutConfig : BaseEntity
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string ConfigJson { get; set; } = string.Empty;
        public bool IsDefault { get; set; }

        public User? User { get; set; }
    }
}
