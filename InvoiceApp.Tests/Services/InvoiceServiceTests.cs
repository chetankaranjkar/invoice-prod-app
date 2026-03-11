using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;
using InvoiceApp.Domain.Entities;
using Moq;
using Xunit;

namespace InvoiceApp.Tests.Services
{
    public class InvoiceServiceTests
    {
        private readonly Mock<IInvoiceRepository> _invoiceRepoMock;
        private readonly Mock<ICustomerRepository> _customerRepoMock;
        private readonly Mock<IUserService> _userServiceMock;
        private readonly Mock<IUserManagementService> _userManagementMock;
        private readonly IMapper _mapper;
        private readonly InvoiceService _sut;

        public InvoiceServiceTests()
        {
            _invoiceRepoMock = new Mock<IInvoiceRepository>();
            _customerRepoMock = new Mock<ICustomerRepository>();
            _userServiceMock = new Mock<IUserService>();
            _userManagementMock = new Mock<IUserManagementService>();

            var config = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<InvoiceApp.Application.MappingProfile>();
            });
            _mapper = config.CreateMapper();

            _sut = new InvoiceService(
                _invoiceRepoMock.Object,
                _customerRepoMock.Object,
                _userServiceMock.Object,
                _userManagementMock.Object,
                _mapper);
        }

        [Fact]
        public async Task CreateInvoiceAsync_MasterUserRole_ThrowsUnauthorizedAccessException()
        {
            var userId = Guid.NewGuid();
            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto>
                {
                    new() { ProductName = "Item1", Quantity = 1, Rate = 100, GstPercentage = 18 }
                }
            };

            var act = () => _sut.CreateInvoiceAsync(userId, createDto, "MasterUser");

            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("MasterUser cannot create invoices. Only Admin and User roles can create invoices.");
        }

        [Fact]
        public async Task CreateInvoiceAsync_CustomerNotFound_ThrowsArgumentException()
        {
            var userId = Guid.NewGuid();
            var createDto = new CreateInvoiceDto
            {
                CustomerId = 999,
                Items = new List<InvoiceItemDto>
                {
                    new() { ProductName = "Item1", Quantity = 1, Rate = 100, GstPercentage = 18 }
                }
            };

            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(999, userId))
                .ReturnsAsync((CustomerProfileDto?)null);

            var act = () => _sut.CreateInvoiceAsync(userId, createDto, "User");

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("Customer not found");
        }

        [Fact]
        public async Task CreateInvoiceAsync_CustomerBelongsToDifferentUser_ThrowsArgumentException()
        {
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();
            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto>
                {
                    new() { ProductName = "Item1", Quantity = 1, Rate = 100, GstPercentage = 18 }
                }
            };

            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId))
                .ReturnsAsync(new CustomerProfileDto { Id = 1, UserId = otherUserId, CustomerName = "Test" });

            var act = () => _sut.CreateInvoiceAsync(userId, createDto, "User");

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("Customer not found");
        }

        [Fact]
        public async Task CreateInvoiceAsync_ValidInput_CreatesInvoiceSuccessfully()
        {
            var userId = Guid.NewGuid();
            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto>
                {
                    new() { ProductName = "Item1", Quantity = 2, Rate = 100, GstPercentage = 18 }
                }
            };

            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId))
                .ReturnsAsync(new CustomerProfileDto { Id = 1, UserId = userId, CustomerName = "Test Customer" });

            _userServiceMock.Setup(x => x.GetUserProfileAsync(userId))
                .ReturnsAsync(new UserProfileDto { Id = userId, InvoicePrefix = "INV", Name = "User", Email = "u@test.com" });

            _invoiceRepoMock.Setup(x => x.GenerateInvoiceNumberAsync(userId, "INV"))
                .ReturnsAsync("INV0001 / 24-25");

            Invoice? capturedInvoice = null;
            _invoiceRepoMock.Setup(x => x.AddAsync(It.IsAny<Invoice>()))
                .Callback<Invoice>(inv => capturedInvoice = inv)
                .ReturnsAsync((Invoice inv) => { inv.Id = 1; return inv; });

            _invoiceRepoMock.Setup(x => x.GetByUserIdAsync(userId))
                .ReturnsAsync(new List<Invoice>());

            var result = await _sut.CreateInvoiceAsync(userId, createDto, "User");

            result.Should().NotBeNull();
            result.InvoiceNumber.Should().Be("INV0001 / 24-25");
            result.CustomerId.Should().Be(1);
            result.GrandTotal.Should().Be(236); // 200 + 36 (18% GST)
            result.Status.Should().Be("Unpaid");

            capturedInvoice.Should().NotBeNull();
            capturedInvoice!.InvoiceItems.Should().HaveCount(1);
            capturedInvoice.InvoiceItems.First().Amount.Should().Be(200);
            capturedInvoice.InvoiceItems.First().GstAmount.Should().Be(36);
        }

        [Fact]
        public async Task CreateInvoiceAsync_WithInitialPayment_UpdatesBalanceCorrectly()
        {
            var userId = Guid.NewGuid();
            var createDto = new CreateInvoiceDto
            {
                CustomerId = 1,
                InitialPayment = 100,
                Items = new List<InvoiceItemDto>
                {
                    new() { ProductName = "Item1", Quantity = 1, Rate = 100, GstPercentage = 18 }
                }
            };

            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId))
                .ReturnsAsync(new CustomerProfileDto { Id = 1, UserId = userId, CustomerName = "Test" });

            _userServiceMock.Setup(x => x.GetUserProfileAsync(userId))
                .ReturnsAsync(new UserProfileDto { Id = userId, InvoicePrefix = "INV", Name = "User", Email = "u@test.com" });

            _invoiceRepoMock.Setup(x => x.GenerateInvoiceNumberAsync(userId, "INV"))
                .ReturnsAsync("INV0001 / 24-25");

            Invoice? capturedInvoice = null;
            _invoiceRepoMock.Setup(x => x.AddAsync(It.IsAny<Invoice>()))
                .Callback<Invoice>(inv => capturedInvoice = inv)
                .ReturnsAsync((Invoice inv) => { inv.Id = 1; return inv; });

            _invoiceRepoMock.Setup(x => x.GetByUserIdAsync(userId))
                .ReturnsAsync(new List<Invoice>());

            var result = await _sut.CreateInvoiceAsync(userId, createDto, "User");

            result.Should().NotBeNull();
            result.PaidAmount.Should().Be(100);
            result.BalanceAmount.Should().Be(18); // 118 total - 100 paid
            result.Status.Should().Be("Partially Paid");
            capturedInvoice!.Payments.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetUserInvoicesAsync_ReturnsMappedInvoices()
        {
            var userId = Guid.NewGuid();
            var invoices = new List<Invoice>
            {
                new() { Id = 1, InvoiceNumber = "INV001", UserId = userId, CustomerId = 1, GrandTotal = 100 }
            };

            _invoiceRepoMock.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync(invoices);

            var result = await _sut.GetUserInvoicesAsync(userId);

            result.Should().HaveCount(1);
            result[0].InvoiceNumber.Should().Be("INV001");
        }

        [Fact]
        public async Task GetInvoiceByIdAsync_InvoiceNotFound_ReturnsNull()
        {
            _invoiceRepoMock.Setup(x => x.GetByIdAsync(999)).ReturnsAsync((Invoice?)null);

            var result = await _sut.GetInvoiceByIdAsync(999, Guid.NewGuid(), "User");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetInvoiceByIdAsync_UserOwnsInvoice_ReturnsInvoice()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                InvoiceNumber = "INV001",
                UserId = userId,
                CustomerId = 1,
                GrandTotal = 100,
                Customer = new Customer { CustomerName = "Test" }
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var result = await _sut.GetInvoiceByIdAsync(1, userId, "User");

            result.Should().NotBeNull();
            result!.InvoiceNumber.Should().Be("INV001");
        }

        [Fact]
        public async Task GetInvoiceByIdAsync_UserDoesNotOwnInvoice_ReturnsNull()
        {
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                InvoiceNumber = "INV001",
                UserId = otherUserId,
                CustomerId = 1,
                GrandTotal = 100
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var result = await _sut.GetInvoiceByIdAsync(1, userId, "User");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetInvoiceByIdAsync_MasterUser_CanViewAnyInvoice()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                InvoiceNumber = "INV001",
                UserId = Guid.NewGuid(),
                CustomerId = 1,
                GrandTotal = 100,
                Customer = new Customer { CustomerName = "Test" }
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var result = await _sut.GetInvoiceByIdAsync(1, userId, "MasterUser");

            result.Should().NotBeNull();
            result!.InvoiceNumber.Should().Be("INV001");
        }

        [Fact]
        public async Task DeleteInvoiceAsync_InvoiceNotFound_ReturnsFalse()
        {
            _invoiceRepoMock.Setup(x => x.GetByIdAsync(999)).ReturnsAsync((Invoice?)null);

            var result = await _sut.DeleteInvoiceAsync(999, Guid.NewGuid(), "User");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task DeleteInvoiceAsync_UserDoesNotOwnInvoice_ReturnsFalse()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = Guid.NewGuid(),
                CustomerId = 1
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var result = await _sut.DeleteInvoiceAsync(1, userId, "User");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task DeleteInvoiceAsync_UserOwnsInvoice_DeletesSuccessfully()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = userId,
                CustomerId = 1
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);
            _invoiceRepoMock.Setup(x => x.DeleteAsync(1)).ReturnsAsync(true);
            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId))
                .ReturnsAsync(new CustomerProfileDto { Id = 1, UserId = userId });
            _invoiceRepoMock.Setup(x => x.GetByUserIdAsync(userId))
                .ReturnsAsync(new List<Invoice>());

            var result = await _sut.DeleteInvoiceAsync(1, userId, "User");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task AddPaymentAsync_InvoiceNotFound_ReturnsFalse()
        {
            _invoiceRepoMock.Setup(x => x.GetByIdAsync(999)).ReturnsAsync((Invoice?)null);

            var result = await _sut.AddPaymentAsync(999, Guid.NewGuid(), new PaymentDto { AmountPaid = 50 }, "User");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task AddPaymentAsync_UserDoesNotOwnInvoice_ReturnsFalse()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = Guid.NewGuid(),
                CustomerId = 1,
                GrandTotal = 100,
                PaidAmount = 0
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var result = await _sut.AddPaymentAsync(1, userId, new PaymentDto { AmountPaid = 50 }, "User");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task AddPaymentAsync_ValidPayment_AddsSuccessfully()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = userId,
                CustomerId = 1,
                GrandTotal = 118,
                PaidAmount = 0,
                BalanceAmount = 118,
                Customer = new Customer { Id = 1, UserId = userId }
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);
            _customerRepoMock.Setup(x => x.GetCustomerByIdAsync(1, userId))
                .ReturnsAsync(new CustomerProfileDto { Id = 1, UserId = userId });
            _invoiceRepoMock.Setup(x => x.GetByUserIdAsync(userId))
                .ReturnsAsync(new List<Invoice> { invoice });

            var result = await _sut.AddPaymentAsync(1, userId, new PaymentDto { AmountPaid = 50, PaymentMode = "Cash" }, "User");

            result.Should().BeTrue();
            _invoiceRepoMock.Verify(x => x.UpdateAsync(It.IsAny<Invoice>()), Times.Once);
        }

        [Fact]
        public async Task UpdateInvoiceAsync_InvoiceNotFound_ThrowsArgumentException()
        {
            _invoiceRepoMock.Setup(x => x.GetByIdAsync(999)).ReturnsAsync((Invoice?)null);

            var updateDto = new UpdateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto> { new() { ProductName = "X", Quantity = 1, Rate = 100, GstPercentage = 18 } }
            };

            var act = () => _sut.UpdateInvoiceAsync(999, Guid.NewGuid(), updateDto, "User");

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("Invoice not found");
        }

        [Fact]
        public async Task UpdateInvoiceAsync_InvoiceHasPayments_ThrowsInvalidOperationException()
        {
            var userId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = userId,
                CustomerId = 1,
                Payments = new List<Payment> { new() { AmountPaid = 50 } }
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var updateDto = new UpdateInvoiceDto
            {
                CustomerId = 1,
                Items = new List<InvoiceItemDto> { new() { ProductName = "X", Quantity = 1, Rate = 100, GstPercentage = 18 } }
            };

            var act = () => _sut.UpdateInvoiceAsync(1, userId, updateDto, "User");

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Cannot update invoice that has payments. Please delete payments first or create a new invoice.");
        }

        [Fact]
        public async Task DuplicateInvoiceAsync_InvoiceNotFound_ThrowsArgumentException()
        {
            _invoiceRepoMock.Setup(x => x.GetByIdAsync(999)).ReturnsAsync((Invoice?)null);

            var act = () => _sut.DuplicateInvoiceAsync(999, Guid.NewGuid(), "User");

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("Invoice not found");
        }

        [Fact]
        public async Task DuplicateInvoiceAsync_UserDoesNotOwnInvoice_ThrowsUnauthorizedAccessException()
        {
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = 1,
                UserId = otherUserId,
                CustomerId = 1,
                GrandTotal = 100,
                InvoiceItems = new List<InvoiceItem> { new() { ProductName = "X", Quantity = 1, Rate = 100, GstAmount = 18 } }
            };

            _invoiceRepoMock.Setup(x => x.GetByIdAsync(1)).ReturnsAsync(invoice);

            var act = () => _sut.DuplicateInvoiceAsync(1, userId, "User");

            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("You don't have permission to duplicate this invoice");
        }
    }
}
