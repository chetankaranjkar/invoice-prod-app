using AutoMapper;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace InvoiceApp.Infrastructure.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        private readonly AppDbContext _context;
        private readonly IMapper _mapper;

        public CustomerRepository(AppDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<CustomerProfileDto?> GetCustomerByIdAsync(int customerId, Guid userId)
        {
            var customer = await _context.Customers
                .Where(c => c.Id == customerId && c.UserId == userId)
                .FirstOrDefaultAsync();

            return customer == null ? null : _mapper.Map<CustomerProfileDto>(customer);
        }

        // Overload to check if customer is accessible via invoices (for Admin/MasterUser)
        public async Task<CustomerProfileDto?> GetCustomerByIdAsync(int customerId, Guid userId, string userRole)
        {
            // First try the standard check (customer belongs to user)
            var customer = await _context.Customers
                .Where(c => c.Id == customerId && c.UserId == userId)
                .FirstOrDefaultAsync();

            if (customer != null)
                return _mapper.Map<CustomerProfileDto>(customer);

            // For MasterUser, allow access to any customer that has invoices
            if (userRole == "MasterUser")
            {
                var masterCustomer = await _context.Customers
                    .Where(c => c.Id == customerId)
                    .FirstOrDefaultAsync();

                if (masterCustomer != null)
                    return _mapper.Map<CustomerProfileDto>(masterCustomer);
            }

            // For Admin, check if customer is used in invoices from users they created
            if (userRole == "Admin")
            {
                // Get all user IDs created by this admin
                var createdUserIds = await _context.Users
                    .Where(u => u.CreatedBy == userId)
                    .Select(u => u.Id)
                    .ToListAsync();

                // Check if customer belongs to admin or any user they created
                var adminCustomer = await _context.Customers
                    .Where(c => c.Id == customerId && (c.UserId == userId || createdUserIds.Contains(c.UserId)))
                    .FirstOrDefaultAsync();

                if (adminCustomer != null)
                    return _mapper.Map<CustomerProfileDto>(adminCustomer);
            }

            return null;
        }

        public async Task<List<CustomerProfileDto>> GetCustomersByUserIdAsync(Guid userId)
        {
            var customers = await _context.Customers
                .Where(c => c.UserId == userId)
                .OrderBy(c => c.CustomerName)
                .ToListAsync();

            return _mapper.Map<List<CustomerProfileDto>>(customers);
        }

        public async Task<CustomerProfileDto> CreateCustomerAsync(Guid userId, CreateCustomerDto createDto)
        {
            // Validate: CustomerName must be unique per user (case-insensitive)
            var existingCustomerName = await _context.Customers
                .AnyAsync(c => c.UserId == userId && 
                              c.CustomerName.ToLower() == createDto.CustomerName.ToLower());
            
            if (existingCustomerName)
            {
                throw new InvalidOperationException($"A customer with name '{createDto.CustomerName}' already exists. Please use a different name.");
            }

            // Validate: GstNumber must be unique globally if provided (case-insensitive)
            if (!string.IsNullOrWhiteSpace(createDto.GstNumber))
            {
                var existingGst = await _context.Customers
                    .AnyAsync(c => c.GstNumber != null && 
                                  c.GstNumber.ToLower() == createDto.GstNumber.ToLower());
                
                if (existingGst)
                {
                    throw new InvalidOperationException($"A customer with GST Number '{createDto.GstNumber}' already exists. Please use a different GST Number.");
                }
            }

            // Validate: PanNumber must be unique globally if provided (case-insensitive)
            if (!string.IsNullOrWhiteSpace(createDto.PanNumber))
            {
                var existingPan = await _context.Customers
                    .AnyAsync(c => c.PanNumber != null && 
                                  c.PanNumber.ToUpper() == createDto.PanNumber.ToUpper());
                
                if (existingPan)
                {
                    throw new InvalidOperationException($"A customer with PAN Number '{createDto.PanNumber}' already exists. Please use a different PAN Number.");
                }
            }

            var customer = _mapper.Map<Customer>(createDto);
            customer.UserId = userId;
            customer.CreatedAt = DateTime.UtcNow;
            customer.UpdatedAt = DateTime.UtcNow;

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            return _mapper.Map<CustomerProfileDto>(customer);
        }

        public async Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, UpdateCustomerDto updateDto)
        {
            var customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId && c.UserId == userId);

            if (customer == null) return null;

            // Validate: CustomerName must be unique per user (case-insensitive) if being changed
            if (!string.IsNullOrEmpty(updateDto.CustomerName) && 
                customer.CustomerName.ToLower() != updateDto.CustomerName.ToLower())
            {
                var existingCustomerName = await _context.Customers
                    .AnyAsync(c => c.UserId == userId && 
                                  c.Id != customerId &&
                                  c.CustomerName.ToLower() == updateDto.CustomerName.ToLower());
                
                if (existingCustomerName)
                {
                    throw new InvalidOperationException($"A customer with name '{updateDto.CustomerName}' already exists. Please use a different name.");
                }
                customer.CustomerName = updateDto.CustomerName;
            }

            // Validate: GstNumber must be unique globally if provided and being changed (case-insensitive)
            if (updateDto.GstNumber != null && 
                (customer.GstNumber == null || customer.GstNumber.ToLower() != updateDto.GstNumber.ToLower()))
            {
                var existingGst = await _context.Customers
                    .AnyAsync(c => c.Id != customerId &&
                                  c.GstNumber != null && 
                                  c.GstNumber.ToLower() == updateDto.GstNumber.ToLower());
                
                if (existingGst)
                {
                    throw new InvalidOperationException($"A customer with GST Number '{updateDto.GstNumber}' already exists. Please use a different GST Number.");
                }
                customer.GstNumber = updateDto.GstNumber;
            }

            // Validate: PanNumber must be unique globally if provided and being changed (case-insensitive)
            if (updateDto.PanNumber != null && 
                (customer.PanNumber == null || customer.PanNumber.ToUpper() != updateDto.PanNumber.ToUpper()))
            {
                var existingPan = await _context.Customers
                    .AnyAsync(c => c.Id != customerId &&
                                  c.PanNumber != null && 
                                  c.PanNumber.ToUpper() == updateDto.PanNumber.ToUpper());
                
                if (existingPan)
                {
                    throw new InvalidOperationException($"A customer with PAN Number '{updateDto.PanNumber}' already exists. Please use a different PAN Number.");
                }
                customer.PanNumber = updateDto.PanNumber;
            }

            // Update other properties if they are provided
            if (updateDto.Email != null)
                customer.Email = updateDto.Email;

            if (updateDto.Phone != null)
                customer.Phone = updateDto.Phone;

            if (updateDto.BillingAddress != null)
                customer.BillingAddress = updateDto.BillingAddress;

            if (updateDto.BankName != null)
                customer.BankName = updateDto.BankName;

            if (updateDto.BankAccountNo != null)
                customer.BankAccountNo = updateDto.BankAccountNo;

            if (updateDto.IfscCode != null)
                customer.IfscCode = updateDto.IfscCode;

            if (updateDto.City != null)
                customer.City = updateDto.City;

            if (updateDto.State != null)
                customer.State = updateDto.State;

            if (updateDto.Zip != null)
                customer.Zip = updateDto.Zip;

            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return _mapper.Map<CustomerProfileDto>(customer);
        }

        public async Task<bool> DeleteCustomerAsync(int customerId, Guid userId)
        {
            var customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId && c.UserId == userId);

            if (customer == null) return false;

            // Check if customer has invoices
            var hasInvoices = await _context.Invoices
                .AnyAsync(i => i.CustomerId == customerId);

            if (hasInvoices)
            {
                throw new InvalidOperationException("Cannot delete customer with existing invoices. Please delete the invoices first.");
            }

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<decimal> GetCustomerTotalBalanceAsync(int customerId, Guid userId)
        {
            var customer = await _context.Customers
                .Where(c => c.Id == customerId && c.UserId == userId)
                .Select(c => c.TotalBalance)
                .FirstOrDefaultAsync();

            return customer;
        }

        public async Task<List<CustomerProfileDto>> SearchCustomersAsync(Guid userId, string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return await GetCustomersByUserIdAsync(userId);

            var customers = await _context.Customers
                .Where(c => c.UserId == userId &&
                           (c.CustomerName.Contains(searchTerm) ||
                            c.Email.Contains(searchTerm) ||
                            c.Phone.Contains(searchTerm) ||
                            c.GstNumber.Contains(searchTerm) ||
                            c.City.Contains(searchTerm)))
                .OrderBy(c => c.CustomerName)
                .ToListAsync();

            return _mapper.Map<List<CustomerProfileDto>>(customers);
        }

       

        public async Task UpdateCustomerBalanceAsync(int customerId, decimal newBalance)
        {
            await _context.Customers
                .Where(c => c.Id == customerId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(c => c.TotalBalance, newBalance)
                    .SetProperty(c => c.UpdatedAt, DateTime.UtcNow)
                );
        }
    }
}