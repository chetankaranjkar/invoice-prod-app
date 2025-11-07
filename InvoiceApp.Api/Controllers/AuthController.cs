using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IUserContext _userContext;

        public AuthController(IAuthService authService, IUserContext userContext)
        {
            _authService = authService;
            _userContext = userContext;
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto loginDto)
        {
            var result = await _authService.LoginAsync(loginDto);

            if (result == null)
                return Unauthorized("Invalid email or password");

            return Ok(result);
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto registerDto)
        {
            var result = await _authService.RegisterAsync(registerDto);

            if (result == null)
                return BadRequest("User with this email already exists");

            return Ok(result);
        }

        [HttpGet("me")]
        [Authorize]
        public ActionResult<object> GetCurrentUser()
        {
            var userId = _userContext.GetCurrentUserId();
            var userEmail = _userContext.GetCurrentUserEmail();
            var userName = _userContext.GetCurrentUserName();

            return Ok(new
            {
                UserId = userId,
                Email = userEmail,
                Name = userName,
                IsAuthenticated = _userContext.IsAuthenticated()
            });
        }
    }
}