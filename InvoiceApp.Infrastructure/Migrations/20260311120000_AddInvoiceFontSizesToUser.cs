using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260311120000_AddInvoiceFontSizesToUser")]
    public partial class AddInvoiceFontSizesToUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InvoiceHeaderFontSize",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AddressSectionFontSize",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UseDefaultInvoiceFontSizes",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceHeaderFontSize",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AddressSectionFontSize",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UseDefaultInvoiceFontSizes",
                table: "Users");
        }
    }
}
