using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Infrastructure.Data;
using InvoiceApp.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using BCrypt.Net;

namespace InvoiceApp.Infrastructure.Seed
{
    public class DatabaseSeed
    {
        private readonly AppDbContext _context;

        public DatabaseSeed(AppDbContext context)
        {
            _context = context;
        }

        public async Task SeedAsync()
        {
            await SeedUsersAsync();
            await SeedCustomersAsync();
            await SeedInvoicesAsync();
        }


        private async Task SeedUsersAsync()
        {
            // Only seed if no users exist
            if (!await _context.Users.AnyAsync())
            {
                // Create only the MasterUser - chetan.karanjkar@gmail.com
                var masterUser = new User
                {
                    Id = Guid.NewGuid(),
                    Name = "Chetan Karanjkar",
                    Email = "chetan.karanjkar@gmail.com",
                    PasswordHash = HashPassword("Medrio@1234"),
                    Role = "MasterUser", // Only MasterUser in the system
                    BusinessName = "Invoice Master",
                    GstNumber = "07AABCU9603R1ZM",
                    Address = "123 Business Park, New Delhi, India",
                    BankName = "State Bank of India",
                    BankAccountNo = "12345678901",
                    IfscCode = "SBIN0001234",
                    PanNumber = "BBPK5069A",
                    Phone = "+91-9876543210",
                    HeaderLogoBgColor = "#ffffff",
                    AddressSectionBgColor = "#ffffff",
                    HeaderLogoTextColor = "#111111",
                    AddressSectionTextColor = "#111111",
                    InvoicePrefix = "INV",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = null // MasterUser has no creator
                };

                await _context.Users.AddAsync(masterUser);
                await _context.SaveChangesAsync();
            }
            else
            {
                var usersToUpdate = await _context.Users
                    .Where(u =>
                        u.HeaderLogoBgColor == null ||
                        u.AddressSectionBgColor == null ||
                        u.HeaderLogoTextColor == null ||
                        u.AddressSectionTextColor == null)
                    .ToListAsync();

                if (usersToUpdate.Count > 0)
                {
                    foreach (var user in usersToUpdate)
                    {
                        user.HeaderLogoBgColor ??= "#ffffff";
                        user.AddressSectionBgColor ??= "#ffffff";
                        user.HeaderLogoTextColor ??= "#111111";
                        user.AddressSectionTextColor ??= "#111111";
                    }

                    await _context.SaveChangesAsync();
                }
            }
        }

        private string HashPassword(string password)
        {
            // Use BCrypt for secure password hashing
            return BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(12));
        }

        private async Task SeedCustomersAsync()
        {
            // Don't seed customers - MasterUser cannot create invoices, so no need for sample customers
            // Customers will be created by Admin/User accounts when they create invoices
            await Task.CompletedTask;
        }

        private async Task SeedInvoicesAsync()
        {
            // Don't seed invoices - MasterUser cannot create invoices
            // Invoices will be created by Admin/User accounts
            await Task.CompletedTask;
        }

        private async Task SeedPaymentsAsync()
        {
            // Don't seed payments - no invoices to seed
            await Task.CompletedTask;
        }
    }
}