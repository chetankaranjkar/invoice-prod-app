using System;

namespace InvoiceApp.Domain.Entities
{
    public class AuditLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid? UserId { get; set; } // User who performed the action
        public string? UserName { get; set; } // Name of the user who performed the action
        public string? UserEmail { get; set; } // Email of the user who performed the action
        public string Action { get; set; } = null!; // CREATE, UPDATE, DELETE, ADD_PAYMENT, etc.
        public string EntityType { get; set; } = null!; // User, Invoice, Customer, Payment, etc.
        public string? EntityId { get; set; } // ID of the entity that was changed
        public string? EntityName { get; set; } // Name/identifier of the entity (e.g., invoice number, customer name)
        public string? OldValues { get; set; } // JSON string of old values (for UPDATE)
        public string? NewValues { get; set; } // JSON string of new values
        public string? Changes { get; set; } // Human-readable description of changes
        public string? IpAddress { get; set; } // IP address of the user
        public string? UserAgent { get; set; } // Browser/client information
        public string? Remarks { get; set; } // Additional notes
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

