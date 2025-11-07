using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Application.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto?> LoginAsync(LoginDto loginDto);
        Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto);
        Guid? GetUserIdFromToken(string token);
    }
}