using InvoiceApp.Application.DTOs;
using InvoiceApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Application.Interfaces
{
    public interface ICustomerRepository
    {
        Task<CustomerProfileDto?> GetCustomerByIdAsync(int customerId, Guid userId);
        Task<List<CustomerProfileDto>> GetCustomersByUserIdAsync(Guid userId);
        Task<CustomerProfileDto> CreateCustomerAsync(Guid userId, CreateCustomerDto createDto);
        Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, UpdateCustomerDto updateDto);
        Task<bool> DeleteCustomerAsync(int customerId, Guid userId);
        Task<decimal> GetCustomerTotalBalanceAsync(int customerId, Guid userId);
        Task<List<CustomerProfileDto>> SearchCustomersAsync(Guid userId, string searchTerm);

        public  Task UpdateCustomerBalanceAsync(int customerId, decimal newBalance);

    }
}
