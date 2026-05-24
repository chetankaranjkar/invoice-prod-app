using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260522120000_AddProductAndInvoiceItemHierarchy")]
    public partial class AddProductAndInvoiceItemHierarchy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProductType",
                table: "Products",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "parent");

            migrationBuilder.AddColumn<int>(
                name: "ParentProductId",
                table: "Products",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AffectTotal",
                table: "Products",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "Taxable",
                table: "Products",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "InheritGstFromParent",
                table: "Products",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Products",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Products",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_ParentProductId",
                table: "Products",
                column: "ParentProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_UserId_ProductType",
                table: "Products",
                columns: new[] { "UserId", "ProductType" });

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Products_ParentProductId",
                table: "Products",
                column: "ParentProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "InvoiceItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParentInvoiceItemId",
                table: "InvoiceItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HierarchyLevel",
                table: "InvoiceItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "AffectTotal",
                table: "InvoiceItems",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "Taxable",
                table: "InvoiceItems",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "InvoiceItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "ShowOnInvoice",
                table: "InvoiceItems",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_ProductId",
                table: "InvoiceItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_ParentInvoiceItemId",
                table: "InvoiceItems",
                column: "ParentInvoiceItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_InvoiceId_DisplayOrder",
                table: "InvoiceItems",
                columns: new[] { "InvoiceId", "DisplayOrder" });

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_InvoiceItems_ParentInvoiceItemId",
                table: "InvoiceItems",
                column: "ParentInvoiceItemId",
                principalTable: "InvoiceItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_Products_ProductId",
                table: "InvoiceItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_InvoiceItems_Products_ProductId", table: "InvoiceItems");
            migrationBuilder.DropForeignKey(name: "FK_InvoiceItems_InvoiceItems_ParentInvoiceItemId", table: "InvoiceItems");
            migrationBuilder.DropIndex(name: "IX_InvoiceItems_InvoiceId_DisplayOrder", table: "InvoiceItems");
            migrationBuilder.DropIndex(name: "IX_InvoiceItems_ParentInvoiceItemId", table: "InvoiceItems");
            migrationBuilder.DropIndex(name: "IX_InvoiceItems_ProductId", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "ShowOnInvoice", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "DisplayOrder", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "Taxable", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "AffectTotal", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "HierarchyLevel", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "ParentInvoiceItemId", table: "InvoiceItems");
            migrationBuilder.DropColumn(name: "ProductId", table: "InvoiceItems");

            migrationBuilder.DropForeignKey(name: "FK_Products_Products_ParentProductId", table: "Products");
            migrationBuilder.DropIndex(name: "IX_Products_UserId_ProductType", table: "Products");
            migrationBuilder.DropIndex(name: "IX_Products_ParentProductId", table: "Products");
            migrationBuilder.DropColumn(name: "IsActive", table: "Products");
            migrationBuilder.DropColumn(name: "Description", table: "Products");
            migrationBuilder.DropColumn(name: "InheritGstFromParent", table: "Products");
            migrationBuilder.DropColumn(name: "Taxable", table: "Products");
            migrationBuilder.DropColumn(name: "AffectTotal", table: "Products");
            migrationBuilder.DropColumn(name: "ParentProductId", table: "Products");
            migrationBuilder.DropColumn(name: "ProductType", table: "Products");
        }
    }
}
