using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System.IO;

namespace InvoiceApp.Infrastructure.Data
{
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            // Build configuration from appsettings.json
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
                .AddEnvironmentVariables()
                .Build();

            // Get connection string
            var connectionString = configuration.GetConnectionString("DefaultConnection");

            // If connection string is not found, try to construct it from individual settings
            if (string.IsNullOrEmpty(connectionString))
            {
                var server = configuration["Database:Server"] ?? "localhost,1434";
                var database = configuration["Database:Database"] ?? "InvoiceAppDb";
                var userId = configuration["Database:UserId"] ?? "sa";
                var password = configuration["Database:Password"] ?? "YourStrong@Password123";
                var trustServerCertificate = configuration["Database:TrustServerCertificate"] ?? "true";

                connectionString = $"Server={server};Database={database};User Id={userId};Password={password};TrustServerCertificate={trustServerCertificate};";
            }

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseSqlServer(connectionString,
                sqlOptions => sqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: System.TimeSpan.FromSeconds(30),
                    errorNumbersToAdd: null));

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
