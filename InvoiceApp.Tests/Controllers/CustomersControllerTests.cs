using System;
using System.Collections.Generic;
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
    public class CustomersControllerTests
    {
        private readonly Mock<ICustomerRepository> _customerRepoMock;
        private readonly Mock<IUserContext> _userContextMock;
        private readonly Mock<IUserManagementService> _userManagementMock;
        private readonly CustomersController _controller;

        public CustomersControllerTests()
        {
            _customerRepoMock = new Mock<ICustomerRepository>();
            _userContextMock = new Mock<IUserContext>();
            _userManagementMock = new Mock<IUserManagementService>();
            _controller = new CustomersController(
                _customerRepoMock.Object,
                _userContextMock.Object,
                _userManagementMock.Object);
        }

        [Fact]
        public async Task GetCustomers_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);

            var result = await _controller.GetCustomers();

            result.Result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task GetCustomers_RegularUser_ReturnsUserCustomers()
        {
            var userId = Guid.NewGuid();
            var customers = new List<CustomerProfileDto>
            {
                new() { Id = 1, UserId = userId, CustomerName = "Test Customer" }
            };

            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _customerRepoMock.Setup(x => x.GetCustomersByUserIdAsync(userId)).ReturnsAsync(customers);

            var result = await _controller.GetCustomers();

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var data = okResult.Value.Should().BeAssignableTo<List<CustomerProfileDto>>().Subject;
            data.Should().HaveCount(1);
            data[0].CustomerName.Should().Be("Test Customer");
        }

        [Fact]
        public async Task GetCustomer_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);

            var result = await _controller.GetCustomer(1);

            result.Result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task GetCustomer_NotFound_ReturnsNotFound()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId, "User")).ReturnsAsync((CustomerProfileDto?)null);

            var result = await _controller.GetCustomer(1);

            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task CreateCustomer_MasterUser_ReturnsForbid()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("MasterUser");

            var createDto = new CreateCustomerDto { CustomerName = "Test" };

            var result = await _controller.CreateCustomer(createDto);

            result.Result.Should().BeOfType<ForbidResult>();
        }

        [Fact]
        public async Task CreateCustomer_ValidInput_ReturnsCreated()
        {
            var userId = Guid.NewGuid();
            var createdCustomer = new CustomerProfileDto
            {
                Id = 1,
                UserId = userId,
                CustomerName = "New Customer"
            };

            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _customerRepoMock.Setup(x => x.CreateCustomerAsync(userId, It.IsAny<CreateCustomerDto>()))
                .ReturnsAsync(createdCustomer);

            var createDto = new CreateCustomerDto { CustomerName = "New Customer" };

            var result = await _controller.CreateCustomer(createDto);

            var createdResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
            createdResult.Value.Should().BeEquivalentTo(createdCustomer);
        }

        [Fact]
        public async Task UpdateCustomer_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);

            var result = await _controller.UpdateCustomer(1, new UpdateCustomerDto());

            result.Result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task UpdateCustomer_NotFound_ReturnsNotFound()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _customerRepoMock.Setup(x => x.UpdateCustomerAsync(1, userId, It.IsAny<UpdateCustomerDto>()))
                .ReturnsAsync((CustomerProfileDto?)null);

            var result = await _controller.UpdateCustomer(1, new UpdateCustomerDto { CustomerName = "Updated" });

            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task DeleteCustomer_Success_ReturnsNoContent()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _customerRepoMock.Setup(x => x.DeleteCustomerAsync(1, userId)).ReturnsAsync(true);

            var result = await _controller.DeleteCustomer(1);

            result.Should().BeOfType<NoContentResult>();
        }

        [Fact]
        public async Task SearchCustomers_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);

            var result = await _controller.SearchCustomers("test");

            result.Result.Should().BeOfType<UnauthorizedResult>();
        }
    }
}
