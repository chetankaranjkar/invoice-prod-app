using System;

namespace InvoiceApp.Application.DTOs
{
    public class UserProfileDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = "User";
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? MembershipNo { get; set; }
        public string? GstpNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? LogoUrl { get; set; }
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public int? InvoiceHeaderFontSize { get; set; }
        public int? AddressSectionFontSize { get; set; }
        public bool UseDefaultInvoiceFontSizes { get; set; } = true;
        public string? GpayNumber { get; set; }
        public string? TaxPractitionerTitle { get; set; }
        public string? DateFormat { get; set; }
        public string? InvoicePrefix { get; set; }
        public decimal DefaultGstPercentage { get; set; } = 18;
        public bool DisableQuantity { get; set; } = false;
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
        public string? MembershipNo { get; set; }
        public string? GstpNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public int? InvoiceHeaderFontSize { get; set; }
        public int? AddressSectionFontSize { get; set; }
        public bool? UseDefaultInvoiceFontSizes { get; set; }
        public string? GpayNumber { get; set; }
        public string? TaxPractitionerTitle { get; set; }
        public string? DateFormat { get; set; }
        public string? InvoicePrefix { get; set; }
        public decimal? DefaultGstPercentage { get; set; }
        public bool? DisableQuantity { get; set; }
    }

    public class CreateUserDto
    {
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string Role { get; set; } = "User";
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
        public string? PanNumber { get; set; }
        public string? MembershipNo { get; set; }
        public string? GstpNumber { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public string? GpayNumber { get; set; }
    }

    public class UserListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = "User";
        public string? BusinessName { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? CreatedByName { get; set; } // Name of the user who created this user
        public string? Address { get; set; }
        public string? HeaderLogoBgColor { get; set; }
        public string? AddressSectionBgColor { get; set; }
        public string? HeaderLogoTextColor { get; set; }
        public string? AddressSectionTextColor { get; set; }
        public string? TaxPractitionerTitle { get; set; }
        public string? MembershipNo { get; set; }
        public string? GstpNumber { get; set; }
        public string? Phone { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
    }
}