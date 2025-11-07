using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InvoiceApp.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginDto loginDto)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

            if (user == null)
                return null;

            // Simple password check for demo - in production use proper hashing
            if (user.PasswordHash != HashPassword(loginDto.Password))
                return null;

            return GenerateJwtToken(user);
        }

        public async Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto)
        {
            // Check if user already exists
            if (await _context.Users.AnyAsync(u => u.Email == registerDto.Email))
                return null;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = registerDto.Name,
                Email = registerDto.Email,
                PasswordHash = HashPassword(registerDto.Password),
                BusinessName = registerDto.BusinessName,
                GstNumber = registerDto.GstNumber,
                BankName = registerDto.BankName,
                BankAccountNo = registerDto.BankAccountNo,
                IfscCode = registerDto.IfscCode,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return GenerateJwtToken(user);
        }

        public Guid? GetUserIdFromToken(string token)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"]!);

                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

                var jwtToken = (JwtSecurityToken)validatedToken;
                var userId = Guid.Parse(jwtToken.Claims.First(x => x.Type == "userid").Value);

                return userId;
            }
            catch
            {
                return null;
            }
        }

        private AuthResponseDto GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();

            // Use ASCII encoding for the secret key to avoid encoding issues
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"] ?? "YourSuperSecretKeyForJWTTokenGeneration2024!");

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim("userid", user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Name, user.Name)
                }),
                Expires = DateTime.UtcNow.AddMinutes(3), // 3 minutes expiration
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            // Ensure the token string is clean
            tokenString = RemoveNonAsciiCharacters(tokenString);

            return new AuthResponseDto
            {
                Token = tokenString,
                UserId = user.Id,
                Email = user.Email,
                Name = user.Name,
                Expires = tokenDescriptor.Expires.Value
            };
        }

        private string HashPassword(string password)
        {
            // Simple hashing for demo - in production use proper hashing
            var secret = _configuration["Jwt:Secret"] ?? "YourSuperSecretKeyForJWTTokenGeneration2024!";
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(password + secret));
        }

        private string RemoveNonAsciiCharacters(string input)
        {
            // Remove any non-ASCII characters that might cause encoding issues
            return System.Text.Encoding.ASCII.GetString(
                System.Text.Encoding.ASCII.GetBytes(input));
        }
    }
}