using Microsoft.Extensions.DependencyInjection;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;
using AutoMapper;
using System.Reflection;

namespace InvoiceApp.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // Register AutoMapper
            services.AddAutoMapper(Assembly.GetExecutingAssembly());

            // Register Application Services
            services.AddScoped<IInvoiceService, InvoiceService>();
            services.AddScoped<IInvoiceTemplateService, InvoiceTemplateService>();
            services.AddScoped<IRecurringInvoiceService, RecurringInvoiceService>();
            services.AddScoped<IInvoiceLayoutService, InvoiceLayoutService>();
            services.AddScoped<IProductService, ProductService>();
            services.AddSingleton<IInvoiceLayoutSchemaProvider, InvoiceLayoutSchemaProvider>();

            return services;
        }
    }
}