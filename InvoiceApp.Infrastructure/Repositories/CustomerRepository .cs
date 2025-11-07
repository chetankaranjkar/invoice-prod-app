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

            // Update properties if they are provided
            if (!string.IsNullOrEmpty(updateDto.CustomerName))
                customer.CustomerName = updateDto.CustomerName;

            if (updateDto.GstNumber != null)
                customer.GstNumber = updateDto.GstNumber;

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

            if (updateDto.PanNumber != null)
                customer.PanNumber = updateDto.PanNumber;

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