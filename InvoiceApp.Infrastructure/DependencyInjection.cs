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
                    sqlOptions => sqlOptions.EnableRetryOnFailure()));

            // Add HttpContextAccessor for file uploads
            services.AddHttpContextAccessor();

            // Register DbContext
            services.AddScoped<AppDbContext>();

            // Repositories
            services.AddScoped<ICustomerRepository, CustomerRepository>();
            services.AddScoped<IInvoiceRepository, InvoiceRepository>();

            // Services
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IUserService, UserService>();  // UserService is in Infrastructure
            services.AddScoped<IUserContext, UserContext>();

            services.AddScoped<DatabaseHealthService>();

            return services;
        }
    }
}