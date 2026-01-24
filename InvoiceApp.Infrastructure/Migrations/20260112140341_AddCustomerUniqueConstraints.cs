using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InvoiceApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerUniqueConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Clean up duplicate GST Numbers (keep the first one, nullify others)
            migrationBuilder.Sql(@"
                WITH DuplicateGST AS (
                    SELECT Id, GstNumber, ROW_NUMBER() OVER (PARTITION BY GstNumber ORDER BY Id) as RowNum
                    FROM Customers
                    WHERE GstNumber IS NOT NULL AND GstNumber != ''
                )
                UPDATE Customers
                SET GstNumber = NULL
                FROM Customers c
                INNER JOIN DuplicateGST d ON c.Id = d.Id
                WHERE d.RowNum > 1;
            ");

            // Step 2: Clean up duplicate PAN Numbers (keep the first one, nullify others)
            migrationBuilder.Sql(@"
                WITH DuplicatePAN AS (
                    SELECT Id, PanNumber, ROW_NUMBER() OVER (PARTITION BY UPPER(PanNumber) ORDER BY Id) as RowNum
                    FROM Customers
                    WHERE PanNumber IS NOT NULL AND PanNumber != ''
                )
                UPDATE Customers
                SET PanNumber = NULL
                FROM Customers c
                INNER JOIN DuplicatePAN d ON c.Id = d.Id
                WHERE d.RowNum > 1;
            ");

            // Step 3: Clean up duplicate Customer Names per User (keep the first one, append suffix to others)
            migrationBuilder.Sql(@"
                WITH DuplicateNames AS (
                    SELECT Id, UserId, CustomerName, ROW_NUMBER() OVER (PARTITION BY UserId, LOWER(CustomerName) ORDER BY Id) as RowNum
                    FROM Customers
                )
                UPDATE c
                SET CustomerName = c.CustomerName + ' (Duplicate ' + CAST(d.RowNum AS VARCHAR) + ')'
                FROM Customers c
                INNER JOIN DuplicateNames d ON c.Id = d.Id
                WHERE d.RowNum > 1;
            ");

            migrationBuilder.DropIndex(
                name: "IX_Customers_UserId",
                table: "Customers");

            migrationBuilder.AlterColumn<string>(
                name: "PanNumber",
                table: "Customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Customers_GstNumber",
                table: "Customers",
                column: "GstNumber",
                unique: true,
                filter: "[GstNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_PanNumber",
                table: "Customers",
                column: "PanNumber",
                unique: true,
                filter: "[PanNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_UserId_CustomerName",
                table: "Customers",
                columns: new[] { "UserId", "CustomerName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Customers_GstNumber",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_PanNumber",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_UserId_CustomerName",
                table: "Customers");

            migrationBuilder.AlterColumn<string>(
                name: "PanNumber",
                table: "Customers",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Customers_UserId",
                table: "Customers",
                column: "UserId");
        }
    }
}
