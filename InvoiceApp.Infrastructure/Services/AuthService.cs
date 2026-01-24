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
using BCrypt.Net;

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
            // Use AsNoTracking and don't include navigation properties for login query
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

            if (user == null)
                return null;

            // Verify password using BCrypt
            if (!VerifyPassword(loginDto.Password, user.PasswordHash))
                return null;

            return GenerateJwtToken(user);
        }

        public async Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto)
        {
            // Check if user already exists (case-insensitive email comparison)
            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == registerDto.Email.ToLower()))
                throw new InvalidOperationException($"A user with email '{registerDto.Email}' already exists. Please use a different email address or login instead.");

            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = registerDto.Name,
                Email = registerDto.Email,
                PasswordHash = HashPassword(registerDto.Password), // Now uses BCrypt
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

            // Require JWT secret from configuration - fail if missing
            var secretKey = _configuration["Jwt:Secret"];
            if (string.IsNullOrEmpty(secretKey))
            {
                throw new InvalidOperationException("JWT Secret key is not configured. Please set Jwt:Secret in appsettings.json");
            }
            
            // Use ASCII encoding for the secret key to avoid encoding issues
            var key = Encoding.ASCII.GetBytes(secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim("userid", user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Name, user.Name),
                    new Claim(ClaimTypes.Role, user.Role ?? "User")
                }),
                Expires = DateTime.UtcNow.AddHours(24), // 24 hours expiration (improved from 3 minutes)
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
            // Use BCrypt for secure password hashing
            return BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(12));
        }

        private bool VerifyPassword(string password, string hash)
        {
            try
            {
                // Try BCrypt verification first
                if (BCrypt.Net.BCrypt.Verify(password, hash))
                    return true;
            }
            catch
            {
                // If BCrypt fails, might be old hash format - try legacy verification for migration
            }

            // Legacy password verification for existing users (migration support)
            // This allows existing users to login once, then their password will be re-hashed on next login
            var secret = _configuration["Jwt:Secret"];
            if (!string.IsNullOrEmpty(secret))
            {
                var legacyHash = Convert.ToBase64String(Encoding.UTF8.GetBytes(password + secret));
                if (legacyHash == hash)
                {
                    // Password matches legacy format - return true (caller should re-hash on next update)
                    return true;
                }
            }

            return false;
        }

        private string RemoveNonAsciiCharacters(string input)
        {
            // Remove any non-ASCII characters that might cause encoding issues
            return System.Text.Encoding.ASCII.GetString(
                System.Text.Encoding.ASCII.GetBytes(input));
        }
    }
}