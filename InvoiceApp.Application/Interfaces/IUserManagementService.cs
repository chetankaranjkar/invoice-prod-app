using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Application.Interfaces
{
    public interface IUserManagementService
    {
        Task<List<UserListDto>> GetAllUsersAsync(Guid currentUserId, string currentUserRole);
        Task<UserListDto?> CreateUserAsync(CreateUserDto createUserDto, Guid creatorId, string creatorRole);
        Task<bool> DeleteUserAsync(Guid userId, Guid currentUserId, string currentUserRole);
        Task<UserListDto?> UpdateUserAsync(Guid userId, CreateUserDto updateUserDto, Guid currentUserId, string currentUserRole);
        Task<UserListDto?> GetUserByIdAsync(Guid userId, Guid currentUserId, string currentUserRole);
    }
}

