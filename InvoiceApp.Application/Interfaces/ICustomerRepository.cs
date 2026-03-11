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
        Task<CustomerProfileDto?> GetCustomerByIdAsync(int customerId, Guid userId, string userRole); // Overload for role-based access
        Task<List<CustomerProfileDto>> GetCustomersByUserIdAsync(Guid userId);
        /// <summary>For Admin: returns customers from admin + all users they created.</summary>
        Task<List<CustomerProfileDto>> GetCustomersForAdminAsync(Guid adminId);
        Task<CustomerProfileDto> CreateCustomerAsync(Guid userId, CreateCustomerDto createDto);
        Task ShareCustomerWithUsersAsync(int customerId, Guid adminId, List<Guid> userIds);
        /// <summary>Update customer. Use overload with userRole for Admin/MasterUser access.</summary>
        Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, UpdateCustomerDto updateDto);
        /// <summary>Update customer with role-based access (Admin can update customers from users they created).</summary>
        Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, string userRole, UpdateCustomerDto updateDto);
        Task<bool> DeleteCustomerAsync(int customerId, Guid userId);
        Task<decimal> GetCustomerTotalBalanceAsync(int customerId, Guid userId);
        Task<List<CustomerProfileDto>> SearchCustomersAsync(Guid userId, string searchTerm);

        public  Task UpdateCustomerBalanceAsync(int customerId, decimal newBalance);

    }
}
