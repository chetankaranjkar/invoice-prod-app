using System.Threading.Tasks;
using FluentAssertions;
using InvoiceApp.Api.Controllers;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace InvoiceApp.Tests.Controllers
{
    public class AuthControllerTests
    {
        private readonly Mock<IAuthService> _authServiceMock;
        private readonly Mock<IUserContext> _userContextMock;
        private readonly AuthController _controller;

        public AuthControllerTests()
        {
            _authServiceMock = new Mock<IAuthService>();
            _userContextMock = new Mock<IUserContext>();
            _controller = new AuthController(_authServiceMock.Object, _userContextMock.Object);
        }

        [Fact]
        public async Task Login_InvalidCredentials_ReturnsUnauthorized()
        {
            _authServiceMock.Setup(x => x.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync((AuthResponseDto?)null);

            var result = await _controller.Login(new LoginDto { Email = "bad@test.com", Password = "wrong" });

            result.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task Login_ValidCredentials_ReturnsOk()
        {
            var authResponse = new AuthResponseDto
            {
                Token = "jwt-token",
                UserId = System.Guid.NewGuid(),
                Email = "user@test.com",
                Name = "Test User"
            };

            _authServiceMock.Setup(x => x.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync(authResponse);

            var result = await _controller.Login(new LoginDto { Email = "user@test.com", Password = "pass" });

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            okResult.Value.Should().BeEquivalentTo(authResponse);
        }

        [Fact]
        public async Task Register_Failed_ReturnsBadRequest()
        {
            _authServiceMock.Setup(x => x.RegisterAsync(It.IsAny<RegisterDto>())).ReturnsAsync((AuthResponseDto?)null);

            var result = await _controller.Register(new RegisterDto
            {
                Name = "Test",
                Email = "test@test.com",
                Password = "pass"
            });

            result.Result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Register_DuplicateEmail_ReturnsBadRequest()
        {
            _authServiceMock.Setup(x => x.RegisterAsync(It.IsAny<RegisterDto>()))
                .ThrowsAsync(new InvalidOperationException("Email already exists"));

            var result = await _controller.Register(new RegisterDto
            {
                Name = "Test",
                Email = "existing@test.com",
                Password = "pass"
            });

            result.Result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Register_ValidInput_ReturnsOk()
        {
            var authResponse = new AuthResponseDto
            {
                Token = "jwt-token",
                UserId = System.Guid.NewGuid(),
                Email = "new@test.com",
                Name = "New User"
            };

            _authServiceMock.Setup(x => x.RegisterAsync(It.IsAny<RegisterDto>())).ReturnsAsync(authResponse);

            var result = await _controller.Register(new RegisterDto
            {
                Name = "New User",
                Email = "new@test.com",
                Password = "pass"
            });

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            okResult.Value.Should().BeEquivalentTo(authResponse);
        }

        [Fact]
        public void GetCurrentUser_Authenticated_ReturnsUserInfo()
        {
            var userId = System.Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserEmail()).Returns("user@test.com");
            _userContextMock.Setup(x => x.GetCurrentUserName()).Returns("Test User");
            _userContextMock.Setup(x => x.IsAuthenticated()).Returns(true);

            var result = _controller.GetCurrentUser();

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            okResult.Value.Should().NotBeNull();
        }
    }
}
