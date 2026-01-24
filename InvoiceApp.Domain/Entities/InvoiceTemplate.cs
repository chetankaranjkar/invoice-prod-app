using System;
using System.Collections.Generic;

namespace InvoiceApp.Domain.Entities
{
    public class InvoiceTemplate : BaseEntity
    {
        public string TemplateName { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public string? Description { get; set; }

        public User? User { get; set; }
        public ICollection<InvoiceTemplateItem> TemplateItems { get; set; } = new List<InvoiceTemplateItem>();
    }
}
