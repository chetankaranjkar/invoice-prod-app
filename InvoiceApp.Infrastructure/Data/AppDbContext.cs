using Microsoft.EntityFrameworkCore;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Infrastructure.Data
{
    public class AppDbContext : DbContext, IAppDbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        public DbSet<User> Users { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<InvoiceItem> InvoiceItems { get; set; }
        public DbSet<Payment> Payments { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);


            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.Property(u => u.Name).IsRequired().HasMaxLength(200);
                entity.Property(u => u.Email).IsRequired().HasMaxLength(200);
                entity.Property(u => u.PasswordHash).IsRequired();
                entity.Property(u => u.BusinessName).HasMaxLength(300);
                entity.Property(u => u.GstNumber).HasMaxLength(50);
                entity.Property(u => u.BankName).HasMaxLength(100);
                entity.Property(u => u.BankAccountNo).HasMaxLength(50);
                entity.Property(u => u.IfscCode).HasMaxLength(20);
                entity.Property(u => u.PanNumber).HasMaxLength(50);  // Add this
                entity.Property(u => u.Phone).HasMaxLength(20);     // Add this
                entity.Property(u => u.LogoUrl).HasMaxLength(500);  // Add this
                entity.Property(u => u.Address).HasMaxLength(1000); // Add this

                entity.HasIndex(u => u.Email).IsUnique();
            });

            // Customer configuration
            modelBuilder.Entity<Customer>(entity =>
            {
                entity.HasKey(c => c.Id);
                entity.Property(c => c.CustomerName).IsRequired().HasMaxLength(200);
                entity.Property(c => c.GstNumber).HasMaxLength(50);
                entity.Property(c => c.Email).HasMaxLength(200);
                entity.Property(c => c.Phone).HasMaxLength(20);
                entity.Property(c => c.BillingAddress).HasMaxLength(500);
                entity.Property(c => c.BankName).HasMaxLength(100);
                entity.Property(c => c.BankAccountNo).HasMaxLength(50);
                entity.Property(c => c.IfscCode).HasMaxLength(20);
                entity.Property(c => c.TotalBalance).HasPrecision(18, 2);

                entity.HasOne(c => c.User)
                      .WithMany(u => u.Customers)
                      .HasForeignKey(c => c.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Invoice configuration
            modelBuilder.Entity<Invoice>(entity =>
            {
                entity.HasKey(i => i.Id);
                entity.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(50);
                entity.Property(i => i.TotalAmount).HasPrecision(18, 2);
                entity.Property(i => i.GstPercentage).HasPrecision(5, 2);
                entity.Property(i => i.GstAmount).HasPrecision(18, 2);
                entity.Property(i => i.Cgst).HasPrecision(18, 2);
                entity.Property(i => i.Sgst).HasPrecision(18, 2);
                entity.Property(i => i.GrandTotal).HasPrecision(18, 2);
                entity.Property(i => i.PaidAmount).HasPrecision(18, 2);
                entity.Property(i => i.BalanceAmount).HasPrecision(18, 2);
                entity.Property(i => i.Status).HasMaxLength(20);

                entity.HasIndex(i => i.InvoiceNumber).IsUnique();

                entity.HasOne(i => i.User)
                      .WithMany(u => u.Invoices)
                      .HasForeignKey(i => i.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(i => i.Customer)
                      .WithMany(c => c.Invoices)
                      .HasForeignKey(i => i.CustomerId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // InvoiceItem configuration
            modelBuilder.Entity<InvoiceItem>(entity =>
            {
                entity.HasKey(ii => ii.Id);
                entity.Property(ii => ii.ProductName).IsRequired().HasMaxLength(200);
                entity.Property(ii => ii.Rate).HasPrecision(18, 2);
                entity.Property(ii => ii.Amount).HasPrecision(18, 2);
                entity.Property(ii => ii.GstPercentage).HasPrecision(5, 2);
                entity.Property(ii => ii.GstAmount).HasPrecision(18, 2);
                entity.Property(ii => ii.Cgst).HasPrecision(18, 2);
                entity.Property(ii => ii.Sgst).HasPrecision(18, 2);

                entity.HasOne(ii => ii.Invoice)
                      .WithMany(i => i.InvoiceItems)
                      .HasForeignKey(ii => ii.InvoiceId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Payment configuration
            modelBuilder.Entity<Payment>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.AmountPaid).HasPrecision(18, 2);
                entity.Property(p => p.PaymentMode).HasMaxLength(50);
                entity.Property(p => p.Remarks).HasMaxLength(500);

                entity.HasOne(p => p.Invoice)
                      .WithMany(i => i.Payments)
                      .HasForeignKey(p => p.InvoiceId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }

    }
}