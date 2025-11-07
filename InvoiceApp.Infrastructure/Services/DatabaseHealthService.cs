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
            catch
            {
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
            var canConnect = await IsDatabaseConnectedAsync();
            if (!canConnect)
                return "❌ Database connection failed";

            var isCreated = await IsDatabaseCreatedAsync();
            if (!isCreated)
                return "⚠️ Database connected but not fully created";

            var userCount = await _context.Users.CountAsync();
            var invoiceCount = await _context.Invoices.CountAsync();

            return $"✅ Database healthy - Users: {userCount}, Invoices: {invoiceCount}";
        }
    }
}