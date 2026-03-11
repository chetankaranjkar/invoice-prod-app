using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;  // Reference Application.Interfaces
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;
using AutoMapper;

namespace InvoiceApp.Infrastructure.Services
{
    public class UserService : IUserService  // Implement IUserService from Application
    {
        private readonly AppDbContext _context;
        private readonly IMapper _mapper;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public UserService(AppDbContext context, IMapper mapper, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _mapper = mapper;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<UserProfileDto?> GetUserProfileAsync(Guid userId)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            return user == null ? null : _mapper.Map<UserProfileDto>(user);
        }

        public async Task<UserProfileDto?> UpdateUserProfileAsync(Guid userId, UpdateUserProfileDto updateDto)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return null;

            // Update properties if they are provided
            if (!string.IsNullOrEmpty(updateDto.Name))
                user.Name = updateDto.Name;

            if (!string.IsNullOrEmpty(updateDto.BusinessName))
                user.BusinessName = updateDto.BusinessName;

            if (!string.IsNullOrEmpty(updateDto.GstNumber))
                user.GstNumber = updateDto.GstNumber;

            if (!string.IsNullOrEmpty(updateDto.Address))
                user.Address = updateDto.Address;

            if (!string.IsNullOrEmpty(updateDto.BankName))
                user.BankName = updateDto.BankName;

            if (!string.IsNullOrEmpty(updateDto.BankAccountNo))
                user.BankAccountNo = updateDto.BankAccountNo;

            if (!string.IsNullOrEmpty(updateDto.IfscCode))
                user.IfscCode = updateDto.IfscCode;

            if (!string.IsNullOrEmpty(updateDto.PanNumber))
                user.PanNumber = updateDto.PanNumber;

            if (!string.IsNullOrEmpty(updateDto.MembershipNo))
                user.MembershipNo = updateDto.MembershipNo;

            if (!string.IsNullOrEmpty(updateDto.GstpNumber))
                user.GstpNumber = updateDto.GstpNumber;

            if (!string.IsNullOrEmpty(updateDto.Phone))
                user.Phone = updateDto.Phone;

            if (!string.IsNullOrEmpty(updateDto.City))
                user.City = updateDto.City;

            if (!string.IsNullOrEmpty(updateDto.State))
                user.State = updateDto.State;

            if (!string.IsNullOrEmpty(updateDto.Zip))
                user.Zip = updateDto.Zip;

            if (!string.IsNullOrEmpty(updateDto.HeaderLogoBgColor))
                user.HeaderLogoBgColor = updateDto.HeaderLogoBgColor;

            if (!string.IsNullOrEmpty(updateDto.AddressSectionBgColor))
                user.AddressSectionBgColor = updateDto.AddressSectionBgColor;

            if (!string.IsNullOrEmpty(updateDto.HeaderLogoTextColor))
                user.HeaderLogoTextColor = updateDto.HeaderLogoTextColor;

            if (!string.IsNullOrEmpty(updateDto.AddressSectionTextColor))
                user.AddressSectionTextColor = updateDto.AddressSectionTextColor;

            if (updateDto.InvoiceHeaderFontSize.HasValue)
                user.InvoiceHeaderFontSize = updateDto.InvoiceHeaderFontSize.Value;

            if (updateDto.AddressSectionFontSize.HasValue)
                user.AddressSectionFontSize = updateDto.AddressSectionFontSize.Value;

            if (updateDto.UseDefaultInvoiceFontSizes.HasValue)
                user.UseDefaultInvoiceFontSizes = updateDto.UseDefaultInvoiceFontSizes.Value;

            if (!string.IsNullOrEmpty(updateDto.GpayNumber))
                user.GpayNumber = updateDto.GpayNumber;

            if (updateDto.TaxPractitionerTitle != null)
                user.TaxPractitionerTitle = updateDto.TaxPractitionerTitle;

            if (!string.IsNullOrEmpty(updateDto.DateFormat))
                user.DateFormat = updateDto.DateFormat;

            if (!string.IsNullOrEmpty(updateDto.InvoicePrefix))
                user.InvoicePrefix = updateDto.InvoicePrefix;

            // Update DefaultGstPercentage if provided
            if (updateDto.DefaultGstPercentage.HasValue)
                user.DefaultGstPercentage = updateDto.DefaultGstPercentage.Value;

            // Update DisableQuantity if provided
            if (updateDto.DisableQuantity.HasValue)
                user.DisableQuantity = updateDto.DisableQuantity.Value;

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return _mapper.Map<UserProfileDto>(user);
        }

        public async Task<string?> UploadLogoAsync(Guid userId, IFormFile logoFile)
        {
            if (logoFile == null || logoFile.Length == 0)
                return null;

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp" };
            var extension = Path.GetExtension(logoFile.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
                throw new ArgumentException("Invalid file type. Only image files are allowed.");

            // Validate file size (max 2MB)
            if (logoFile.Length > 2 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum size is 2MB.");

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return null;

            // Create uploads directory if it doesn't exist
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "logos");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            // Generate unique filename
            var fileName = $"{userId}_{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsDir, fileName);

            // Save the file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await logoFile.CopyToAsync(stream);
            }

            // Update user's logo URL
            // Always use relative path - nginx/frontend will proxy /uploads/ to API
            // This works in both development and Docker environments
            user.LogoUrl = $"/uploads/logos/{fileName}";

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return user.LogoUrl;
        }
    }
}