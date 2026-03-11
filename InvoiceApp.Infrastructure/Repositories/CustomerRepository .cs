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
                .Include(c => c.SharedWithUsers)
                .Include(c => c.User)
                .Where(c => c.Id == customerId && (c.UserId == userId || c.SharedWithUsers.Any(cu => cu.UserId == userId)))
                .FirstOrDefaultAsync();

            return customer == null ? null : MapToDto(customer, userId);
        }

        // Overload to check if customer is accessible via invoices (for Admin/MasterUser)
        public async Task<CustomerProfileDto?> GetCustomerByIdAsync(int customerId, Guid userId, string userRole)
        {
            var customer = await _context.Customers
                .Include(c => c.SharedWithUsers)
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.Id == customerId);

            if (customer == null) return null;

            // Owner or shared with user
            if (customer.UserId == userId || customer.SharedWithUsers.Any(cu => cu.UserId == userId))
                return MapToDto(customer, userId);

            // MasterUser: any customer
            if (userRole == "MasterUser")
                return MapToDto(customer, userId);

            // Admin: customer from users they created
            if (userRole == "Admin")
            {
                var createdUserIds = await _context.Users
                    .Where(u => u.CreatedBy == userId)
                    .Select(u => u.Id)
                    .ToListAsync();
                if (createdUserIds.Contains(customer.UserId) || customer.SharedWithUsers.Any(cu => createdUserIds.Contains(cu.UserId)))
                    return MapToDto(customer, userId);
            }

            return null;
        }

        public async Task<List<CustomerProfileDto>> GetCustomersByUserIdAsync(Guid userId)
        {
            var customers = await _context.Customers
                .Include(c => c.User)
                .Include(c => c.SharedWithUsers)
                .Where(c => c.UserId == userId || c.SharedWithUsers.Any(cu => cu.UserId == userId))
                .OrderBy(c => c.CustomerName)
                .ToListAsync();

            return customers.Select(c => MapToDto(c, userId)).ToList();
        }

        public async Task<List<CustomerProfileDto>> GetCustomersForAdminAsync(Guid adminId)
        {
            var createdUserIds = await _context.Users
                .Where(u => u.CreatedBy == adminId)
                .Select(u => u.Id)
                .ToListAsync();
            var allUserIds = new List<Guid> { adminId };
            allUserIds.AddRange(createdUserIds);

            var customers = await _context.Customers
                .Include(c => c.User)
                .Include(c => c.SharedWithUsers)
                .Where(c => allUserIds.Contains(c.UserId) || c.SharedWithUsers.Any(cu => allUserIds.Contains(cu.UserId)))
                .OrderBy(c => c.CustomerName)
                .ToListAsync();

            return customers.Select(c => MapToDto(c, adminId)).ToList();
        }

        private CustomerProfileDto MapToDto(Customer c, Guid currentUserId)
        {
            var dto = _mapper.Map<CustomerProfileDto>(c);
            dto.IsSharedWithMe = c.UserId != currentUserId && c.SharedWithUsers.Any(cu => cu.UserId == currentUserId);
            dto.SharedWithUserIds = c.SharedWithUsers.Select(cu => cu.UserId).ToList();
            return dto;
        }

        public async Task<CustomerProfileDto> CreateCustomerAsync(Guid userId, CreateCustomerDto createDto)
        {
            // Validate: CustomerName is required
            if (string.IsNullOrWhiteSpace(createDto.CustomerName))
            {
                throw new InvalidOperationException("Customer Name is required.");
            }

            // Validate: CustomerName must be unique across all customers user can access (owned + shared, case-insensitive)
            var existingCustomerName = await _context.Customers
                .AnyAsync(c => (c.UserId == userId || c.SharedWithUsers.Any(cu => cu.UserId == userId)) &&
                              c.CustomerName.ToLower() == createDto.CustomerName.Trim().ToLower());

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

            // Convert empty strings to null for optional fields - prevents unique constraint violations
            // (DB unique indexes use IS NOT NULL filter; empty string is not NULL and would conflict)
            if (string.IsNullOrWhiteSpace(customer.GstNumber)) customer.GstNumber = null;
            if (string.IsNullOrWhiteSpace(customer.PanNumber)) customer.PanNumber = null;
            if (string.IsNullOrWhiteSpace(customer.Email)) customer.Email = null;
            if (string.IsNullOrWhiteSpace(customer.Phone)) customer.Phone = null;
            if (string.IsNullOrWhiteSpace(customer.BillingAddress)) customer.BillingAddress = null;
            if (string.IsNullOrWhiteSpace(customer.City)) customer.City = null;
            if (string.IsNullOrWhiteSpace(customer.State)) customer.State = null;
            if (string.IsNullOrWhiteSpace(customer.Zip)) customer.Zip = null;
            if (string.IsNullOrWhiteSpace(customer.BankName)) customer.BankName = null;
            if (string.IsNullOrWhiteSpace(customer.BankAccountNo)) customer.BankAccountNo = null;
            if (string.IsNullOrWhiteSpace(customer.IfscCode)) customer.IfscCode = null;

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            // Share with specified users (Admin only - validated by controller)
            if (createDto.SharedWithUserIds != null && createDto.SharedWithUserIds.Count > 0)
            {
                foreach (var uid in createDto.SharedWithUserIds.Distinct())
                {
                    if (uid != userId) // Don't add owner
                        _context.CustomerUsers.Add(new CustomerUser { CustomerId = customer.Id, UserId = uid });
                }
                await _context.SaveChangesAsync();
            }

            // Reload with SharedWithUsers for MapToDto
            var reloaded = await _context.Customers
                .Include(c => c.User)
                .Include(c => c.SharedWithUsers)
                .FirstAsync(c => c.Id == customer.Id);
            return MapToDto(reloaded, userId);
        }

        public async Task ShareCustomerWithUsersAsync(int customerId, Guid adminId, List<Guid> userIds)
        {
            var customer = await _context.Customers
                .Include(c => c.SharedWithUsers)
                .FirstOrDefaultAsync(c => c.Id == customerId);
            if (customer == null)
                throw new ArgumentException("Customer not found.");

            var createdUserIds = await _context.Users
                .Where(u => u.CreatedBy == adminId)
                .Select(u => u.Id)
                .ToListAsync();
            var allowedUserIds = new HashSet<Guid>(createdUserIds) { adminId };

            if (customer.UserId != adminId && !createdUserIds.Contains(customer.UserId))
                throw new UnauthorizedAccessException("You can only share customers that you own or that belong to users you created.");

            var desiredSet = new HashSet<Guid>(userIds?.Distinct() ?? Enumerable.Empty<Guid>());
            desiredSet.Remove(customer.UserId); // Owner already has access

            // Remove users no longer in the list
            foreach (var cu in customer.SharedWithUsers.ToList())
            {
                if (!desiredSet.Contains(cu.UserId))
                    _context.CustomerUsers.Remove(cu);
            }

            // Add new users (only those admin is allowed to share with)
            var existing = customer.SharedWithUsers.Select(cu => cu.UserId).ToHashSet();
            foreach (var uid in desiredSet)
            {
                if (!allowedUserIds.Contains(uid)) continue;
                if (existing.Contains(uid)) continue;
                _context.CustomerUsers.Add(new CustomerUser { CustomerId = customerId, UserId = uid });
            }
            await _context.SaveChangesAsync();
        }

        public Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, UpdateCustomerDto updateDto)
            => UpdateCustomerAsync(customerId, userId, "User", updateDto);

        public async Task<CustomerProfileDto?> UpdateCustomerAsync(int customerId, Guid userId, string userRole, UpdateCustomerDto updateDto)
        {
            var customer = await _context.Customers
                .Include(c => c.SharedWithUsers)
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.Id == customerId);

            if (customer == null) return null;

            // Check access: owner, shared with, or Admin managing a user's customer
            var hasAccess = customer.UserId == userId || customer.SharedWithUsers.Any(cu => cu.UserId == userId);
            if (!hasAccess && userRole == "Admin")
            {
                var createdUserIds = await _context.Users
                    .Where(u => u.CreatedBy == userId)
                    .Select(u => u.Id)
                    .ToListAsync();
                hasAccess = createdUserIds.Contains(customer.UserId) || customer.SharedWithUsers.Any(cu => createdUserIds.Contains(cu.UserId));
            }
            if (!hasAccess && userRole == "MasterUser")
                hasAccess = true;
            if (!hasAccess) return null;

            var ownerId = customer.UserId; // Use owner for uniqueness checks

            // Validate: CustomerName must be unique per owner (case-insensitive) if being changed
            if (!string.IsNullOrEmpty(updateDto.CustomerName) && 
                customer.CustomerName.ToLower() != updateDto.CustomerName.ToLower())
            {
                var existingCustomerName = await _context.Customers
                    .AnyAsync(c => c.UserId == ownerId && 
                                  c.Id != customerId &&
                                  c.CustomerName.ToLower() == updateDto.CustomerName.ToLower());
                
                if (existingCustomerName)
                {
                    throw new InvalidOperationException($"A customer with name '{updateDto.CustomerName}' already exists. Please use a different name.");
                }
                customer.CustomerName = updateDto.CustomerName;
            }

            // Validate: GstNumber must be unique globally if provided and being changed (case-insensitive)
            // Convert empty string to null to avoid unique constraint violations
            if (updateDto.GstNumber != null)
            {
                var newGst = string.IsNullOrWhiteSpace(updateDto.GstNumber) ? null : updateDto.GstNumber.Trim();
                if (newGst != null && 
                    (customer.GstNumber == null || customer.GstNumber.ToLower() != newGst.ToLower()))
                {
                    var existingGst = await _context.Customers
                        .AnyAsync(c => c.Id != customerId &&
                                      c.GstNumber != null && 
                                      c.GstNumber.ToLower() == newGst.ToLower());
                    
                    if (existingGst)
                    {
                        throw new InvalidOperationException($"A customer with GST Number '{newGst}' already exists. Please use a different GST Number.");
                    }
                }
                customer.GstNumber = newGst;
            }

            // Validate: PanNumber must be unique globally if provided and being changed (case-insensitive)
            if (updateDto.PanNumber != null)
            {
                var newPan = string.IsNullOrWhiteSpace(updateDto.PanNumber) ? null : updateDto.PanNumber.Trim().ToUpper();
                if (newPan != null && 
                    (customer.PanNumber == null || customer.PanNumber.ToUpper() != newPan))
                {
                    var existingPan = await _context.Customers
                        .AnyAsync(c => c.Id != customerId &&
                                      c.PanNumber != null && 
                                      c.PanNumber.ToUpper() == newPan);
                    
                    if (existingPan)
                    {
                        throw new InvalidOperationException($"A customer with PAN Number '{updateDto.PanNumber}' already exists. Please use a different PAN Number.");
                    }
                }
                customer.PanNumber = newPan;
            }

            // Update other properties if provided (convert empty string to null)
            if (updateDto.Email != null)
                customer.Email = string.IsNullOrWhiteSpace(updateDto.Email) ? null : updateDto.Email.Trim();
            if (updateDto.Phone != null)
                customer.Phone = string.IsNullOrWhiteSpace(updateDto.Phone) ? null : updateDto.Phone.Trim();
            if (updateDto.BillingAddress != null)
                customer.BillingAddress = string.IsNullOrWhiteSpace(updateDto.BillingAddress) ? null : updateDto.BillingAddress.Trim();
            if (updateDto.BankName != null)
                customer.BankName = string.IsNullOrWhiteSpace(updateDto.BankName) ? null : updateDto.BankName.Trim();
            if (updateDto.BankAccountNo != null)
                customer.BankAccountNo = string.IsNullOrWhiteSpace(updateDto.BankAccountNo) ? null : updateDto.BankAccountNo.Trim();
            if (updateDto.IfscCode != null)
                customer.IfscCode = string.IsNullOrWhiteSpace(updateDto.IfscCode) ? null : updateDto.IfscCode.Trim();
            if (updateDto.City != null)
                customer.City = string.IsNullOrWhiteSpace(updateDto.City) ? null : updateDto.City.Trim();
            if (updateDto.State != null)
                customer.State = string.IsNullOrWhiteSpace(updateDto.State) ? null : updateDto.State.Trim();

            if (updateDto.Zip != null)
                customer.Zip = updateDto.Zip;

            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return MapToDto(customer, userId);
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
                .Where(c => c.Id == customerId && (c.UserId == userId || c.SharedWithUsers.Any(cu => cu.UserId == userId)))
                .Select(c => c.TotalBalance)
                .FirstOrDefaultAsync();

            return customer;
        }

        public async Task<List<CustomerProfileDto>> SearchCustomersAsync(Guid userId, string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return await GetCustomersByUserIdAsync(userId);

            var customers = await _context.Customers
                .Include(c => c.User)
                .Include(c => c.SharedWithUsers)
                .Where(c => (c.UserId == userId || c.SharedWithUsers.Any(cu => cu.UserId == userId)) &&
                           ((c.CustomerName != null && c.CustomerName.Contains(searchTerm)) ||
                            (c.Email != null && c.Email.Contains(searchTerm)) ||
                            (c.Phone != null && c.Phone.Contains(searchTerm)) ||
                            (c.GstNumber != null && c.GstNumber.Contains(searchTerm)) ||
                            (c.City != null && c.City.Contains(searchTerm))))
                .OrderBy(c => c.CustomerName)
                .ToListAsync();

            return customers.Select(c => MapToDto(c, userId)).ToList();
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