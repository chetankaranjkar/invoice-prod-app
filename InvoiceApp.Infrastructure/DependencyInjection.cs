using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Infrastructure.Data;
using InvoiceApp.Infrastructure.Repositories;
using InvoiceApp.Infrastructure.Services;
using Microsoft.AspNetCore.Http;

namespace InvoiceApp.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, string connectionString)
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(connectionString,
                    sqlOptions => sqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null)));

            // Add HttpContextAccessor for file uploads
            services.AddHttpContextAccessor();

            // Register DbContext
            services.AddScoped<AppDbContext>();

            // Repositories
            services.AddScoped<ICustomerRepository, CustomerRepository>();
            services.AddScoped<IInvoiceRepository, InvoiceRepository>();
            services.AddScoped<IInvoiceTemplateRepository, InvoiceTemplateRepository>();
            services.AddScoped<IRecurringInvoiceRepository, RecurringInvoiceRepository>();
            services.AddScoped<IAuditLogRepository, AuditLogRepository>();
            services.AddScoped<IErrorLogRepository, ErrorLogRepository>();

            // Services
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IUserService, UserService>();  // UserService is in Infrastructure
            services.AddScoped<IUserManagementService, UserManagementService>();
            services.AddScoped<IUserContext, UserContext>();
            services.AddScoped<InvoiceApp.Application.Services.IAuditService, InvoiceApp.Application.Services.AuditService>();
            services.AddScoped<IBackupService, BackupService>();
            services.AddScoped<IErrorLogService, ErrorLogService>();

            services.AddScoped<DatabaseHealthService>();

            return services;
        }
    }
}