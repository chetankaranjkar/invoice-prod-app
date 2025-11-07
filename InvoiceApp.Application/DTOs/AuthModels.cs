namespace InvoiceApp.Application.DTOs
{
    public class LoginDto
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
    }

    public class RegisterDto
    {
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string? BusinessName { get; set; }
        public string? GstNumber { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountNo { get; set; }
        public string? IfscCode { get; set; }
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = null!;
        public Guid UserId { get; set; }
        public string Email { get; set; } = null!;
        public string Name { get; set; } = null!;
        public DateTime Expires { get; set; }
    }
}