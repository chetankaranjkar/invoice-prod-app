using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260302130000_InvoiceNumberPerUserUnique")]
    public partial class InvoiceNumberPerUserUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: invoice numbers are unique per user (each user has their own
            // sequence), not globally. Drop the legacy global unique index if present and
            // add the per-user composite unique index if it is missing. Guarded so it is
            // safe to run regardless of the database's current index state.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoices'))
    DROP INDEX [IX_Invoices_InvoiceNumber] ON [dbo].[Invoices];

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_UserId_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoices'))
    CREATE UNIQUE INDEX [IX_Invoices_UserId_InvoiceNumber] ON [dbo].[Invoices] ([UserId], [InvoiceNumber]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_UserId_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoices'))
    DROP INDEX [IX_Invoices_UserId_InvoiceNumber] ON [dbo].[Invoices];

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoices'))
    CREATE UNIQUE INDEX [IX_Invoices_InvoiceNumber] ON [dbo].[Invoices] ([InvoiceNumber]);
");
        }
    }
}
