using Microsoft.EntityFrameworkCore;
using InvoiceApp.Domain.Entities;
using System.Collections.Generic;

namespace InvoiceApp.Application.Interfaces
{
    public interface IAppDbContext
    {
        
        public DbSet<User> Users { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<InvoiceItem> InvoiceItems { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<InvoiceLayoutConfig> InvoiceLayoutConfigs { get; set; }
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}