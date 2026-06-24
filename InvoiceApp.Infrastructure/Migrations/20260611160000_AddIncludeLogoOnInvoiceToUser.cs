using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260611160000_AddIncludeLogoOnInvoiceToUser")]
    public partial class AddIncludeLogoOnInvoiceToUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IncludeLogoOnInvoice",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IncludeLogoOnInvoice",
                table: "Users");
        }
    }
}
