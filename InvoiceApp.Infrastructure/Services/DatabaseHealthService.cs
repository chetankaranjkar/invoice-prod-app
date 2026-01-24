using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Infrastructure.Data;

namespace InvoiceApp.Infrastructure.Services
{
    public class DatabaseHealthService
    {
        private readonly AppDbContext _context;

        public DatabaseHealthService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> IsDatabaseConnectedAsync()
        {
            try
            {
                return await _context.Database.CanConnectAsync();
            }
            catch (Exception ex)
            {
                // Log the exception for debugging
                Console.WriteLine($"[DatabaseHealth] Connection failed: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"[DatabaseHealth] Inner exception: {ex.InnerException.Message}");
                }
                return false;
            }
        }

        public async Task<bool> IsDatabaseCreatedAsync()
        {
            try
            {
                return await _context.Database.CanConnectAsync() &&
                       await _context.Users.AnyAsync(); // Check if any table exists
            }
            catch
            {
                return false;
            }
        }

        public async Task<string> GetDatabaseStatusAsync()
        {
            try
            {
                var canConnect = await IsDatabaseConnectedAsync();
                if (!canConnect)
                {
                    // Try to get more details about the connection failure
                    try
                    {
                        await _context.Database.CanConnectAsync();
                    }
                    catch (Exception ex)
                    {
                        var errorMsg = ex.InnerException?.Message ?? ex.Message;
                        // Truncate long error messages
                        if (errorMsg.Length > 100)
                            errorMsg = errorMsg.Substring(0, 100) + "...";
                        return $"❌ Database connection failed: {errorMsg}";
                    }
                    return "❌ Database connection failed - Check if SQL Server container is running";
                }

                var isCreated = await IsDatabaseCreatedAsync();
                if (!isCreated)
                    return "⚠️ Database connected but not fully created (migrations may be pending)";

                var userCount = await _context.Users.CountAsync();
                var invoiceCount = await _context.Invoices.CountAsync();

                return $"✅ Database healthy - Users: {userCount}, Invoices: {invoiceCount}";
            }
            catch (Exception ex)
            {
                var errorMsg = ex.InnerException?.Message ?? ex.Message;
                if (errorMsg.Length > 100)
                    errorMsg = errorMsg.Substring(0, 100) + "...";
                return $"❌ Health check error: {errorMsg}";
            }
        }
    }
}