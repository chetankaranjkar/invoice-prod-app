using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Infrastructure.Data;
using InvoiceApp.Domain.Entities;
using System.Collections.Generic;
using System.Linq;

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
            if (!await _context.Users.AnyAsync())
            {
                var users = new List<User>
        {
            new User
            {
                Id = Guid.NewGuid(),
                Name = "John Doe",
                Email = "chetan.karanjkar@gmail.com",
                PasswordHash = HashPassword("Medrio@1234"),
                BusinessName = "John's Business Solutions",
                GstNumber = "07AABCU9603R1ZM",
                Address = "123 Business Park, New Delhi, India",
                BankName = "State Bank of India",
                BankAccountNo = "12345678901",
                IfscCode = "SBIN0001234",
                PanNumber = "BBPK5069A",
                Phone = "+91-9876543210",
                CreatedAt = DateTime.UtcNow
            },
            new User
            {
                Id = Guid.NewGuid(),
                Name = "Jane Smith",
                Email = "jane@example.com",
                PasswordHash = HashPassword("Test@123"),
                BusinessName = "Smith Enterprises",
                GstNumber = "08AABCS1429B1ZP",
                Address = "456 Industrial Area, Mumbai, India",
                BankName = "HDFC Bank",
                BankAccountNo = "98765432109",
                IfscCode = "HDFC0000567",
                PanNumber = "AABC5069A",
                Phone = "+91-8765432109",
                CreatedAt = DateTime.UtcNow
            }
        };

                await _context.Users.AddRangeAsync(users);
                await _context.SaveChangesAsync();
            }
        }

        private string HashPassword(string password)
        {
            // Simple hashing for demo - in production use proper hashing
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(password + "YourJWTSecretKey"));
        }

        private async Task SeedCustomersAsync()
        {
            if (!await _context.Customers.AnyAsync())
            {
                var users = await _context.Users.ToListAsync();

                var customers = new List<Customer>();

                foreach (var user in users)
                {
                    customers.AddRange(new[]
                    {
                        new Customer
                        {
                            UserId = user.Id,
                            CustomerName = "ABC Corporation",
                            GstNumber = "07AABCU9603R1Z1",
                            Email = "abc@corporation.com",
                            Phone = "+91-9876543210",
                            BillingAddress = "123 Business Park, New Delhi, India",
                            BankName = "ICICI Bank",
                            BankAccountNo = "11223344556",
                            IfscCode = "ICIC0000123",
                            TotalBalance = 0,
                            CreatedAt = DateTime.UtcNow
                        },
                        new Customer
                        {
                            UserId = user.Id,
                            CustomerName = "XYZ Industries",
                            GstNumber = "09AAACX1234M1Z2",
                            Email = "contact@xyzindustries.com",
                            Phone = "+91-8765432109",
                            BillingAddress = "456 Industrial Area, Mumbai, India",
                            BankName = "Axis Bank",
                            BankAccountNo = "99887766554",
                            IfscCode = "UTIB0000456",
                            TotalBalance = 0,
                            CreatedAt = DateTime.UtcNow
                        },
                        new Customer
                        {
                            UserId = user.Id,
                            CustomerName = "Global Services Ltd",
                            GstNumber = "06AAGCG1234M1Z3",
                            Email = "info@globalservices.com",
                            Phone = "+91-7654321098",
                            BillingAddress = "789 Tech Park, Bangalore, India",
                            BankName = "Kotak Mahindra Bank",
                            BankAccountNo = "66778899001",
                            IfscCode = "KKBK0000789",
                            TotalBalance = 0,
                            CreatedAt = DateTime.UtcNow
                        }
                    });
                }

                await _context.Customers.AddRangeAsync(customers);
                await _context.SaveChangesAsync();
            }
        }

        private async Task SeedInvoicesAsync()
        {
            if (!await _context.Invoices.AnyAsync())
            {
                var users = await _context.Users.ToListAsync();
                var customers = await _context.Customers.ToListAsync();

                var invoices = new List<Invoice>();
                var random = new Random();

                foreach (var user in users)
                {
                    var userCustomers = customers.Where(c => c.UserId == user.Id).ToList();

                    foreach (var customer in userCustomers.Take(2)) // Create 2 invoices per customer
                    {
                        var invoiceNumber = $"INV{user.Id.ToString().Substring(0, 4).ToUpper()}{customer.Id:D3}";

                        // Create invoice items
                        var items = new List<InvoiceItem>
                        {
                            new InvoiceItem
                            {
                                ProductName = "Web Development Services",
                                Quantity = 10,
                                Rate = 5000,
                                Amount = 50000,
                                GstPercentage = 18,
                                GstAmount = 9000,
                                Cgst = 4500,
                                Sgst = 4500
                            },
                            new InvoiceItem
                            {
                                ProductName = "UI/UX Design",
                                Quantity = 5,
                                Rate = 3000,
                                Amount = 15000,
                                GstPercentage = 18,
                                GstAmount = 2700,
                                Cgst = 1350,
                                Sgst = 1350
                            }
                        };

                        var totalAmount = items.Sum(i => i.Amount);
                        var totalGst = items.Sum(i => i.GstAmount);
                        var grandTotal = totalAmount + totalGst;

                        var invoice = new Invoice
                        {
                            InvoiceNumber = invoiceNumber,
                            UserId = user.Id,
                            CustomerId = customer.Id,
                            InvoiceDate = DateTime.UtcNow.AddDays(-random.Next(1, 30)),
                            DueDate = DateTime.UtcNow.AddDays(30),
                            TotalAmount = totalAmount,
                            GstPercentage = 18,
                            GstAmount = totalGst,
                            Cgst = totalGst / 2,
                            Sgst = totalGst / 2,
                            GrandTotal = grandTotal,
                            PaidAmount = random.Next(0, 2) == 1 ? grandTotal : grandTotal * 0.5m, // Random payment status
                            BalanceAmount = 0, // Will be calculated below
                            Status = "Unpaid",
                            InvoiceItems = items
                        };

                        // Calculate balance
                        invoice.BalanceAmount = invoice.GrandTotal - invoice.PaidAmount;
                        invoice.Status = invoice.BalanceAmount <= 0 ? "Paid" :
                                       invoice.PaidAmount > 0 ? "Partially Paid" : "Unpaid";

                        // Update customer balance
                        customer.TotalBalance += invoice.BalanceAmount;

                        invoices.Add(invoice);
                    }
                }

                await _context.Invoices.AddRangeAsync(invoices);
                await _context.SaveChangesAsync();

                // Create some payments for partially paid invoices
                await SeedPaymentsAsync();
            }
        }

        private async Task SeedPaymentsAsync()
        {
            var partiallyPaidInvoices = await _context.Invoices
                .Where(i => i.Status == "Partially Paid")
                .ToListAsync();

            if (partiallyPaidInvoices.Any())
            {
                var payments = new List<Payment>();
                var random = new Random();

                foreach (var invoice in partiallyPaidInvoices)
                {
                    payments.Add(new Payment
                    {
                        InvoiceId = invoice.Id,
                        AmountPaid = invoice.PaidAmount,
                        PaymentDate = invoice.InvoiceDate.AddDays(random.Next(1, 15)),
                        PaymentMode = random.Next(0, 2) == 1 ? "Bank Transfer" : "UPI",
                        Remarks = "Initial payment"
                    });
                }

                await _context.Payments.AddRangeAsync(payments);
                await _context.SaveChangesAsync();
            }
        }
    }
}