using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260429164500_AddIncludeSignatureOnInvoiceToUser")]
    public partial class AddIncludeSignatureOnInvoiceToUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IncludeSignatureOnInvoice",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IncludeSignatureOnInvoice",
                table: "Users");
        }
    }
}
