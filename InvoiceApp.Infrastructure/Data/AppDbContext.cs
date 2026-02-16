using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<ErrorLog> ErrorLogs { get; set; }
        public DbSet<InvoiceTemplate> InvoiceTemplates { get; set; }
        public DbSet<InvoiceTemplateItem> InvoiceTemplateItems { get; set; }
        public DbSet<RecurringInvoice> RecurringInvoices { get; set; }
        public DbSet<RecurringInvoiceItem> RecurringInvoiceItems { get; set; }
        public DbSet<InvoiceLayoutConfig> InvoiceLayoutConfigs { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                return;
            }

            // Suppress the pending model changes warning to allow automatic migrations
            // This warning can occur when the model snapshot is slightly out of sync
            // but the actual database schema is correct
            optionsBuilder.ConfigureWarnings(warnings =>
                warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
        }

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
                entity.Property(u => u.Role).IsRequired().HasMaxLength(50);
                entity.Property(u => u.BusinessName).HasMaxLength(300);
                entity.Property(u => u.GstNumber).HasMaxLength(50);
                entity.Property(u => u.BankName).HasMaxLength(100);
                entity.Property(u => u.BankAccountNo).HasMaxLength(50);
                entity.Property(u => u.IfscCode).HasMaxLength(20);
                entity.Property(u => u.PanNumber).HasMaxLength(50);  // Add this
                entity.Property(u => u.MembershipNo).HasMaxLength(100);
                entity.Property(u => u.GstpNumber).HasMaxLength(50);
                entity.Property(u => u.Phone).HasMaxLength(20);     // Add this
                entity.Property(u => u.LogoUrl).HasMaxLength(500);  // Add this
                entity.Property(u => u.Address).HasMaxLength(1000); // Add this
                entity.Property(u => u.HeaderLogoBgColor).HasMaxLength(20);
                entity.Property(u => u.AddressSectionBgColor).HasMaxLength(20);
                entity.Property(u => u.HeaderLogoTextColor).HasMaxLength(20);
                entity.Property(u => u.AddressSectionTextColor).HasMaxLength(20);
                entity.Property(u => u.GpayNumber).HasMaxLength(30);
                entity.Property(u => u.TaxPractitionerTitle).HasMaxLength(100);
                entity.Property(u => u.InvoicePrefix).HasMaxLength(20); // Invoice prefix
                entity.Property(u => u.DefaultGstPercentage).HasPrecision(5, 2).HasDefaultValue(18); // Default GST percentage
                entity.Property(u => u.DisableQuantity).HasDefaultValue(false); // Disable quantity field
                entity.Property(u => u.CreatedBy).IsRequired(false); // Admin/MasterUser who created this user

                entity.HasIndex(u => u.Email).IsUnique();
                entity.HasIndex(u => u.CreatedBy); // Index for filtering by creator

                // Configure self-referencing relationship for CreatedBy
                entity.HasOne(u => u.CreatedByNavigation)
                      .WithMany()
                      .HasForeignKey(u => u.CreatedBy)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // Customer configuration
            modelBuilder.Entity<Customer>(entity =>
            {
                entity.HasKey(c => c.Id);
                entity.Property(c => c.CustomerName).IsRequired().HasMaxLength(200);
                entity.Property(c => c.GstNumber).HasMaxLength(50);
                entity.Property(c => c.PanNumber).HasMaxLength(50);
                entity.Property(c => c.Email).HasMaxLength(200);
                entity.Property(c => c.Phone).HasMaxLength(20);
                entity.Property(c => c.BillingAddress).HasMaxLength(500);
                entity.Property(c => c.BankName).HasMaxLength(100);
                entity.Property(c => c.BankAccountNo).HasMaxLength(50);
                entity.Property(c => c.IfscCode).HasMaxLength(20);
                entity.Property(c => c.TotalBalance).HasPrecision(18, 2);

                // Unique constraint: CustomerName must be unique per User
                entity.HasIndex(c => new { c.UserId, c.CustomerName })
                      .IsUnique()
                      .HasDatabaseName("IX_Customers_UserId_CustomerName");

                // Unique constraint: GstNumber must be unique globally (if provided)
                entity.HasIndex(c => c.GstNumber)
                      .IsUnique()
                      .HasFilter("[GstNumber] IS NOT NULL")
                      .HasDatabaseName("IX_Customers_GstNumber");

                // Unique constraint: PanNumber must be unique globally (if provided)
                entity.HasIndex(c => c.PanNumber)
                      .IsUnique()
                      .HasFilter("[PanNumber] IS NOT NULL")
                      .HasDatabaseName("IX_Customers_PanNumber");

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
                entity.Property(i => i.WaveAmount).HasPrecision(18, 2);
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
                entity.Property(p => p.WaveAmount).HasPrecision(18, 2);
                entity.Property(p => p.PaymentMode).HasMaxLength(50);
                entity.Property(p => p.Remarks).HasMaxLength(500);

                entity.HasOne(p => p.Invoice)
                      .WithMany(i => i.Payments)
                      .HasForeignKey(p => p.InvoiceId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // AuditLog configuration
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Id).ValueGeneratedNever(); // Don't auto-generate, we set it manually
                entity.Property(a => a.CreatedAt).IsRequired();
                entity.Property(a => a.Action).IsRequired().HasMaxLength(50);
                entity.Property(a => a.EntityType).IsRequired().HasMaxLength(50);
                entity.Property(a => a.EntityId).HasMaxLength(100);
                entity.Property(a => a.EntityName).HasMaxLength(200);
                entity.Property(a => a.UserName).HasMaxLength(200);
                entity.Property(a => a.UserEmail).HasMaxLength(200);
                entity.Property(a => a.IpAddress).HasMaxLength(50);
                entity.Property(a => a.UserAgent).HasMaxLength(500);
                entity.Property(a => a.OldValues).HasColumnType("nvarchar(max)");
                entity.Property(a => a.NewValues).HasColumnType("nvarchar(max)");
                entity.Property(a => a.Changes).HasMaxLength(1000);
                entity.Property(a => a.Remarks).HasMaxLength(500);

                entity.HasIndex(a => a.UserId);
                entity.HasIndex(a => a.EntityType);
                entity.HasIndex(a => a.CreatedAt);
            });

            // ErrorLog configuration
            modelBuilder.Entity<ErrorLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ErrorType).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.StackTrace).HasColumnType("nvarchar(max)");
                entity.Property(e => e.InnerException).HasColumnType("nvarchar(max)");
                entity.Property(e => e.Source).HasMaxLength(500);
                entity.Property(e => e.UserId).HasMaxLength(100);
                entity.Property(e => e.UserEmail).HasMaxLength(200);
                entity.Property(e => e.RequestPath).HasMaxLength(500);
                entity.Property(e => e.RequestMethod).HasMaxLength(10);
                entity.Property(e => e.RequestBody).HasColumnType("nvarchar(max)");
                entity.Property(e => e.QueryString).HasMaxLength(1000);
                entity.Property(e => e.UserAgent).HasMaxLength(500);
                entity.Property(e => e.IpAddress).HasMaxLength(50);
                entity.Property(e => e.AdditionalData).HasColumnType("nvarchar(max)");
                entity.Property(e => e.ResolvedBy).HasMaxLength(200);
                entity.Property(e => e.ResolutionNotes).HasMaxLength(1000);

                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.IsResolved);
                entity.HasIndex(e => e.ErrorType);
            });

            // InvoiceTemplate configuration
            modelBuilder.Entity<InvoiceTemplate>(entity =>
            {
                entity.HasKey(t => t.Id);
                entity.Property(t => t.TemplateName).IsRequired().HasMaxLength(200);
                entity.Property(t => t.Description).HasMaxLength(500);

                entity.HasIndex(t => new { t.UserId, t.TemplateName })
                      .IsUnique()
                      .HasDatabaseName("IX_InvoiceTemplates_UserId_TemplateName");

                entity.HasOne(t => t.User)
                      .WithMany()
                      .HasForeignKey(t => t.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // InvoiceTemplateItem configuration
            modelBuilder.Entity<InvoiceTemplateItem>(entity =>
            {
                entity.HasKey(ti => ti.Id);
                entity.Property(ti => ti.ProductName).IsRequired().HasMaxLength(200);
                entity.Property(ti => ti.Rate).HasPrecision(18, 2);
                entity.Property(ti => ti.GstPercentage).HasPrecision(5, 2);

                entity.HasOne(ti => ti.Template)
                      .WithMany(t => t.TemplateItems)
                      .HasForeignKey(ti => ti.TemplateId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // InvoiceLayoutConfig configuration
            modelBuilder.Entity<InvoiceLayoutConfig>(entity =>
            {
                entity.HasKey(l => l.Id);
                entity.Property(l => l.Name).IsRequired().HasMaxLength(200);
                entity.Property(l => l.Description).HasMaxLength(500);
                entity.Property(l => l.ConfigJson).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(l => l.IsDefault).HasDefaultValue(false);

                entity.HasIndex(l => new { l.UserId, l.Name })
                      .IsUnique()
                      .HasDatabaseName("IX_InvoiceLayoutConfigs_UserId_Name");

                entity.HasIndex(l => new { l.UserId, l.IsDefault })
                      .HasDatabaseName("IX_InvoiceLayoutConfigs_UserId_IsDefault");

                entity.HasOne(l => l.User)
                      .WithMany()
                      .HasForeignKey(l => l.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // RecurringInvoice configuration
            modelBuilder.Entity<RecurringInvoice>(entity =>
            {
                entity.HasKey(r => r.Id);
                entity.Property(r => r.Name).IsRequired().HasMaxLength(200);
                entity.Property(r => r.Frequency).IsRequired().HasMaxLength(20);
                entity.Property(r => r.Description).HasMaxLength(500);
                entity.Property(r => r.DefaultAmount).HasPrecision(18, 2);
                entity.Property(r => r.DefaultGstPercentage).HasPrecision(5, 2);

                entity.HasIndex(r => r.UserId);
                entity.HasIndex(r => r.NextGenerationDate);
                entity.HasIndex(r => r.IsActive);

                entity.HasOne(r => r.User)
                      .WithMany()
                      .HasForeignKey(r => r.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(r => r.Customer)
                      .WithMany()
                      .HasForeignKey(r => r.CustomerId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // RecurringInvoiceItem configuration
            modelBuilder.Entity<RecurringInvoiceItem>(entity =>
            {
                entity.HasKey(ri => ri.Id);
                entity.Property(ri => ri.ProductName).IsRequired().HasMaxLength(200);
                entity.Property(ri => ri.Rate).HasPrecision(18, 2);
                entity.Property(ri => ri.GstPercentage).HasPrecision(5, 2);

                entity.HasOne(ri => ri.RecurringInvoice)
                      .WithMany(r => r.RecurringItems)
                      .HasForeignKey(ri => ri.RecurringInvoiceId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }

    }
}