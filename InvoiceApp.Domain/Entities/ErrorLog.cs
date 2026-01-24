using System;

namespace InvoiceApp.Domain.Entities
{
    public class ErrorLog : BaseEntity
    {
        public string ErrorType { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? StackTrace { get; set; }
        public string? InnerException { get; set; }
        public string? Source { get; set; }
        public string? UserId { get; set; }
        public string? UserEmail { get; set; }
        public string? RequestPath { get; set; }
        public string? RequestMethod { get; set; }
        public string? RequestBody { get; set; }
        public string? QueryString { get; set; }
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }
        public string? AdditionalData { get; set; }
        public bool IsResolved { get; set; }
        public string? ResolvedBy { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? ResolutionNotes { get; set; }
    }
}
