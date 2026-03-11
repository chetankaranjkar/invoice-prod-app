using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using InvoiceApp.Api.Controllers;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace InvoiceApp.Tests.Controllers
{
    public class InvoicesControllerTests
    {
        private readonly Mock<IInvoiceService> _invoiceServiceMock;
        private readonly Mock<IUserContext> _userContextMock;
        private readonly Mock<IAuditService> _auditServiceMock;
        private readonly InvoicesController _controller;

        public InvoicesControllerTests()
        {
            _invoiceServiceMock = new Mock<IInvoiceService>();
            _userContextMock = new Mock<IUserContext>();
            _auditServiceMock = new Mock<IAuditService>();
            _controller = new InvoicesController(
                _invoiceServiceMock.Object,
                _userContextMock.Object,
                _auditServiceMock.Object);
        }

        [Fact]
        public async Task GetInvoices_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns((string?)null);

            var result = await _controller.GetInvoices();

            result.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task GetInvoices_RegularUser_ReturnsUserInvoices()
        {
            var userId = Guid.NewGuid();
            var invoices = new List<InvoiceDto>
            {
                new() { Id = 1, InvoiceNumber = "INV001", CustomerName = "Test", GrandTotal = 100 }
            };

            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _invoiceServiceMock.Setup(x => x.GetUserInvoicesAsync(userId)).ReturnsAsync(invoices);

            var result = await _controller.GetInvoices();

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var data = okResult.Value.Should().BeAssignableTo<List<InvoiceDto>>().Subject;
            data.Should().HaveCount(1);
            data[0].InvoiceNumber.Should().Be("INV001");
        }

        [Fact]
        public async Task GetInvoices_MasterUser_ReturnsAllInvoices()
        {
            var userId = Guid.NewGuid();
            var invoices = new List<InvoiceDto>
            {
                new() { Id = 1, InvoiceNumber = "INV001", CustomerName = "Test", GrandTotal = 100 }
            };

            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("MasterUser");
            _invoiceServiceMock.Setup(x => x.GetAllInvoicesAsync()).ReturnsAsync(invoices);

            var result = await _controller.GetInvoices();

            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            _invoiceServiceMock.Verify(x => x.GetAllInvoicesAsync(), Times.Once);
        }

        [Fact]
        public async Task GetInvoice_UserNotAuthenticated_ReturnsUnauthorized()
        {
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns((Guid?)null);

            var result = await _controller.GetInvoice(1);

            result.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task GetInvoice_NotFound_ReturnsNotFound()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _invoiceServiceMock.Setup(x => x.GetInvoiceByIdAsync(1, userId, "User")).ReturnsAsync((InvoiceDto?)null);

            var result = await _controller.GetInvoice(1);

            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task CreateInvoice_MasterUser_ReturnsForbid()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("MasterUser");

            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto> { new() { ProductName = "X", Quantity = 1, Rate = 100, GstPercentage = 18 } }
            };

            var result = await _controller.CreateInvoice(createDto);

            result.Result.Should().BeOfType<ForbidResult>();
        }

        [Fact]
        public async Task CreateInvoice_ValidInput_ReturnsCreated()
        {
            var userId = Guid.NewGuid();
            var createdInvoice = new InvoiceDto
            {
                Id = 1,
                InvoiceNumber = "INV001",
                CustomerId = 1,
                CustomerName = "Test",
                GrandTotal = 118
            };

            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _userContextMock.Setup(x => x.GetCurrentUserName()).Returns("Test User");
            _userContextMock.Setup(x => x.GetCurrentUserEmail()).Returns("test@test.com");
            _invoiceServiceMock.Setup(x => x.CreateInvoiceAsync(userId, It.IsAny<CreateInvoiceDto>(), "User"))
                .ReturnsAsync(createdInvoice);

            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto> { new() { ProductName = "X", Quantity = 1, Rate = 100, GstPercentage = 18 } }
            };

            var result = await _controller.CreateInvoice(createDto);

            var createdResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
            createdResult.Value.Should().BeEquivalentTo(createdInvoice);
        }

        [Fact]
        public async Task DeleteInvoice_NotFound_ReturnsNotFound()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _invoiceServiceMock.Setup(x => x.DeleteInvoiceAsync(1, userId, "User")).ReturnsAsync(false);

            var result = await _controller.DeleteInvoice(1);

            result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task DeleteInvoice_Success_ReturnsOk()
        {
            var userId = Guid.NewGuid();
            _userContextMock.Setup(x => x.GetCurrentUserId()).Returns(userId);
            _userContextMock.Setup(x => x.GetCurrentUserRole()).Returns("User");
            _invoiceServiceMock.Setup(x => x.GetInvoiceByIdAsync(1, userId, "User"))
                .ReturnsAsync(new InvoiceDto { InvoiceNumber = "INV001" });
            _invoiceServiceMock.Setup(x => x.DeleteInvoiceAsync(1, userId, "User")).ReturnsAsync(true);

            var result = await _controller.DeleteInvoice(1);

            result.Should().BeOfType<OkObjectResult>();
        }
    }
}
