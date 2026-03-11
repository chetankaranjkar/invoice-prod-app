using System.Text.Json;
using AutoMapper;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Domain.Entities;

namespace InvoiceApp.Application.Resolvers
{
    /// <summary>
    /// Resolves InvoiceDto.SellerInfo from stored snapshot (preferred) or from User. 
    /// Snapshot ensures invoice always shows creator's details as they were at creation, even if profile changes later.
    /// </summary>
    public class InvoiceSellerInfoResolver : IValueResolver<Invoice, InvoiceDto, InvoiceSellerInfoDto?>
    {
        public InvoiceSellerInfoDto? Resolve(Invoice source, InvoiceDto destination, InvoiceSellerInfoDto? destMember, ResolutionContext context)
        {
            // Prefer stored snapshot (captured at invoice creation)
            if (!string.IsNullOrWhiteSpace(source.SellerInfoSnapshot))
            {
                try
                {
                    return JsonSerializer.Deserialize<InvoiceSellerInfoDto>(
                        source.SellerInfoSnapshot,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                catch
                {
                    // Fall through to User mapping if deserialization fails
                }
            }

            // Fallback to current User profile (for old invoices created before snapshot was added)
            if (source.User == null) return null;

            return new InvoiceSellerInfoDto
            {
                Name = source.User.Name,
                Email = source.User.Email,
                BusinessName = source.User.BusinessName,
                GstNumber = source.User.GstNumber,
                Address = source.User.Address,
                BankName = source.User.BankName,
                BankAccountNo = source.User.BankAccountNo,
                IfscCode = source.User.IfscCode,
                PanNumber = source.User.PanNumber,
                MembershipNo = source.User.MembershipNo,
                GstpNumber = source.User.GstpNumber,
                City = source.User.City,
                State = source.User.State,
                Zip = source.User.Zip,
                Phone = source.User.Phone,
                LogoUrl = source.User.LogoUrl,
                HeaderLogoBgColor = source.User.HeaderLogoBgColor,
                AddressSectionBgColor = source.User.AddressSectionBgColor,
                HeaderLogoTextColor = source.User.HeaderLogoTextColor,
                AddressSectionTextColor = source.User.AddressSectionTextColor,
                InvoiceHeaderFontSize = source.User.InvoiceHeaderFontSize,
                AddressSectionFontSize = source.User.AddressSectionFontSize,
                UseDefaultInvoiceFontSizes = source.User.UseDefaultInvoiceFontSizes,
                GpayNumber = source.User.GpayNumber,
                TaxPractitionerTitle = source.User.TaxPractitionerTitle,
            };
        }
    }
}
