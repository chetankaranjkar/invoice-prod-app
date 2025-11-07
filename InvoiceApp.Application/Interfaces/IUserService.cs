using System;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using Microsoft.AspNetCore.Http;

namespace InvoiceApp.Application.Interfaces
{
    public interface IUserService
    {
        Task<UserProfileDto?> GetUserProfileAsync(Guid userId);
        Task<UserProfileDto?> UpdateUserProfileAsync(Guid userId, UpdateUserProfileDto updateDto);
        Task<string?> UploadLogoAsync(Guid userId, IFormFile logoFile);
    }
}