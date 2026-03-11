using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace InvoiceApp.Application.DTOs
{
    public class CustomerProfileDto
    {
        public int Id { get; set; }
        public Guid UserId { get; set; }
        public string? UserName { get; set; }
        /// <summary>True if this customer was shared with the current user (not owned by them).</summary>
        public bool IsSharedWithMe { get; set; }
        /// <summary>User IDs this customer is shared with (Admin only).</summary>
        public List<Guid>? SharedWithUserIds { get; set; }
        public string? UserEmail { get; set; }
        public string CustomerName { get; set; } = null!;
        public string? GstNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? BillingAddress { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public decimal TotalBalance { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CreateCustomerDto
    {
        public string CustomerName { get; set; } = null!;
        /// <summary>Admin only: user IDs to share this customer with (users created by admin).</summary>
        public List<Guid>? SharedWithUserIds { get; set; }
        public string? GstNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? BillingAddress { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
    }

    public class ShareCustomerDto
    {
        [JsonProperty("userIds")]
        public List<Guid> UserIds { get; set; } = new();
    }

    public class UpdateCustomerDto
    {
        public string? CustomerName { get; set; }
        public string? GstNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? BillingAddress { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
    }
}
