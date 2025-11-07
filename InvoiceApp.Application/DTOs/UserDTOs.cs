using System;

namespace InvoiceApp.Application.DTOs
{
    public class UserProfileDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? Phone { get; set; }
        public string? LogoUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class UpdateUserProfileDto
    {
        public string? Name { get; set; }
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? Phone { get; set; }
    }
}