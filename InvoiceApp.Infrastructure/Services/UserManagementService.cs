using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;
using System.Text;
using BCrypt.Net;

namespace InvoiceApp.Infrastructure.Services
{
    public class UserManagementService : IUserManagementService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public UserManagementService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<List<UserListDto>> GetAllUsersAsync(Guid currentUserId, string currentUserRole)
        {
            IQueryable<User> query = _context.Users;

            // MasterUser can see all users
            if (currentUserRole == "MasterUser")
            {
                query = query.Where(u => true); // See all users
            }
            // Admin can see only users they created (and themselves)
            else if (currentUserRole == "Admin")
            {
                query = query.Where(u => u.CreatedBy == currentUserId || u.Id == currentUserId);
            }
            // Regular users cannot access this
            else
            {
                return new List<UserListDto>();
            }

            // Get users with their creators using a join
            var users = await (from u in query
                              join creator in _context.Users on u.CreatedBy equals creator.Id into creatorGroup
                              from creator in creatorGroup.DefaultIfEmpty()
                              orderby u.CreatedAt descending
                              select new UserListDto
                              {
                                  Id = u.Id,
                                  Name = u.Name,
                                  Email = u.Email,
                                  Role = u.Role,
                                  BusinessName = u.BusinessName,
                                  CreatedAt = u.CreatedAt,
                                  CreatedByName = creator != null ? creator.Name : null
                              }).ToListAsync();

            return users;
        }

        public async Task<UserListDto?> CreateUserAsync(CreateUserDto createUserDto, Guid creatorId, string creatorRole)
        {
            // Check if user already exists (case-insensitive email comparison)
            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == createUserDto.Email.ToLower()))
                throw new InvalidOperationException($"A user with email '{createUserDto.Email}' already exists. Please use a different email address.");

            // Prevent creating MasterUser - only one MasterUser exists (chetan.karanjkar@gmail.com)
            if (createUserDto.Role == "MasterUser")
            {
                throw new UnauthorizedAccessException("MasterUser role cannot be created. Only one MasterUser exists in the system.");
            }

            // Enforce hierarchy: MasterUser can only create Admin, Admin can only create User
            string assignedRole;
            if (creatorRole == "MasterUser")
            {
                // MasterUser can only create Admin users
                if (createUserDto.Role != "Admin" && createUserDto.Role != null)
                    throw new UnauthorizedAccessException("MasterUser can only create Admin users");
                assignedRole = "Admin";
            }
            else if (creatorRole == "Admin")
            {
                // Admin can only create User (regular users)
                if (createUserDto.Role != "User" && createUserDto.Role != null)
                    throw new UnauthorizedAccessException("Admin can only create User accounts");
                assignedRole = "User";
            }
            else
            {
                throw new UnauthorizedAccessException("Only MasterUser and Admin can create users");
            }

            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = createUserDto.Name,
                Email = createUserDto.Email,
                PasswordHash = HashPassword(createUserDto.Password),
                Role = assignedRole,
                BusinessName = createUserDto.BusinessName,
                GstNumber = createUserDto.GstNumber,
                Address = createUserDto.Address,
                BankName = createUserDto.BankName,
                BankAccountNo = createUserDto.BankAccountNo,
                IfscCode = createUserDto.IfscCode,
                PanNumber = createUserDto.PanNumber,
                City = createUserDto.City,
                State = createUserDto.State,
                Zip = createUserDto.Zip,
                Phone = createUserDto.Phone,
                CreatedBy = creatorId, // Track who created this user
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return new UserListDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                BusinessName = user.BusinessName,
                CreatedAt = user.CreatedAt,
                CreatedByName = null // Will be populated if needed
            };
        }

        public async Task<bool> DeleteUserAsync(Guid userId, Guid currentUserId, string currentUserRole)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return false;

            // MasterUser can delete any user
            if (currentUserRole == "MasterUser")
            {
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                return true;
            }
            // Admin can only delete users they created
            else if (currentUserRole == "Admin" && user.CreatedBy == currentUserId)
            {
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                return true;
            }

            return false; // Not authorized
        }

        public async Task<UserListDto?> UpdateUserAsync(Guid userId, CreateUserDto updateUserDto, Guid currentUserId, string currentUserRole)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return null;

            // Check permissions
            bool canUpdate = false;
            if (currentUserRole == "MasterUser")
            {
                canUpdate = true; // MasterUser can update any user
            }
            else if (currentUserRole == "Admin" && user.CreatedBy == currentUserId)
            {
                canUpdate = true; // Admin can update users they created
            }

            if (!canUpdate)
                return null; // Not authorized

            // Check if email is being changed and if it already exists (case-insensitive)
            if (user.Email.ToLower() != updateUserDto.Email.ToLower() && 
                await _context.Users.AnyAsync(u => u.Id != userId && u.Email.ToLower() == updateUserDto.Email.ToLower()))
                throw new InvalidOperationException($"A user with email '{updateUserDto.Email}' already exists. Please use a different email address.");

            // Enforce role hierarchy - don't allow role changes that violate hierarchy
            string newRole = updateUserDto.Role ?? user.Role;
            if (currentUserRole == "Admin" && newRole != "User")
            {
                // Admin cannot change user role to anything other than User
                newRole = "User";
            }
            else if (currentUserRole == "MasterUser" && newRole != "Admin" && user.Role == "Admin")
            {
                // MasterUser cannot change Admin role to User
                newRole = "Admin";
            }

            user.Name = updateUserDto.Name;
            user.Email = updateUserDto.Email;
            user.Role = newRole;
            user.BusinessName = updateUserDto.BusinessName;
            user.GstNumber = updateUserDto.GstNumber;
            user.Address = updateUserDto.Address;
            user.BankName = updateUserDto.BankName;
            user.BankAccountNo = updateUserDto.BankAccountNo;
            user.IfscCode = updateUserDto.IfscCode;
            user.PanNumber = updateUserDto.PanNumber;
            user.City = updateUserDto.City;
            user.State = updateUserDto.State;
            user.Zip = updateUserDto.Zip;
            user.Phone = updateUserDto.Phone;

            // Update password if provided
            if (!string.IsNullOrEmpty(updateUserDto.Password))
            {
                user.PasswordHash = HashPassword(updateUserDto.Password);
            }

            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new UserListDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                BusinessName = user.BusinessName,
                CreatedAt = user.CreatedAt,
                CreatedByName = null // Will be populated if needed
            };
        }

        public async Task<UserListDto?> GetUserByIdAsync(Guid userId, Guid currentUserId, string currentUserRole)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return null;

            // Check permissions
            bool canView = false;
            if (currentUserRole == "MasterUser")
            {
                canView = true; // MasterUser can view any user
            }
            else if (currentUserRole == "Admin" && (user.CreatedBy == currentUserId || user.Id == currentUserId))
            {
                canView = true; // Admin can view users they created or themselves
            }

            if (!canView)
                return null; // Not authorized

            return new UserListDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                BusinessName = user.BusinessName,
                CreatedAt = user.CreatedAt,
                CreatedByName = null // Will be populated if needed
            };
        }

        private string HashPassword(string password)
        {
            // Use BCrypt for secure password hashing
            return BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(12));
        }
    }
}

