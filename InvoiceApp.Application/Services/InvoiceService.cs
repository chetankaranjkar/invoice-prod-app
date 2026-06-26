using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AutoMapper;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Application.Services
{
    public class InvoiceService : IInvoiceService
    {
        private readonly IInvoiceRepository _invoiceRepository;
        private readonly ICustomerRepository _customerRepository;
        private readonly IUserService _userService;
        private readonly IUserManagementService _userManagementService;
        private readonly IProductService _productService;
        private readonly IMapper _mapper;

        public InvoiceService(
            IInvoiceRepository invoiceRepository,
            ICustomerRepository customerRepository,
            IUserService userService,
            IUserManagementService userManagementService,
            IProductService productService,
            IMapper mapper)
        {
            _invoiceRepository = invoiceRepository;
            _customerRepository = customerRepository;
            _userService = userService;
            _userManagementService = userManagementService;
            _productService = productService;
            _mapper = mapper;
        }

        // -----------------------------------------------
        // Create Invoice (with optional initial payment)
        // -----------------------------------------------
        public async Task<InvoiceDto> CreateInvoiceAsync(Guid userId, CreateInvoiceDto createInvoiceDto, string? userRole = null)
        {
            // MasterUser cannot create invoices - they can only manage admins
            if (userRole == "MasterUser")
            {
                throw new UnauthorizedAccessException("MasterUser cannot create invoices. Only Admin and User roles can create invoices.");
            }

            Guid effectiveUserId = userId;
            if (userRole == "Admin" && createInvoiceDto.OnBehalfOfUserId.HasValue)
            {
                var createdUserIds = await _userManagementService.GetUserIdsCreatedByAdminAsync(userId);
                if (!createdUserIds.Contains(createInvoiceDto.OnBehalfOfUserId.Value) && createInvoiceDto.OnBehalfOfUserId.Value != userId)
                    throw new UnauthorizedAccessException("You can only create invoices on behalf of users you created or yourself.");
                effectiveUserId = createInvoiceDto.OnBehalfOfUserId.Value;
            }

            // Validate customer is accessible to effective user (owned or shared)
            var customer = await _customerRepository.GetCustomerByIdAsync(createInvoiceDto.CustomerId, effectiveUserId);
            if (customer == null)
                throw new ArgumentException("Customer not found");

            // Invoice date: parse early (needed for FY when auto-generating invoice number)
            DateTime invoiceDate;
            if (!string.IsNullOrWhiteSpace(createInvoiceDto.InvoiceDate) && DateTime.TryParse(createInvoiceDto.InvoiceDate, out var parsedDate))
            {
                if (parsedDate.Date > DateTime.Today)
                    throw new ArgumentException("Invoice date cannot be in the future.");
                invoiceDate = parsedDate.Date;
            }
            else
            {
                invoiceDate = DateTime.UtcNow.Date;
            }

            // Get effective user's invoice prefix and profile (invoice uses their company info)
            var userProfile = await _userService.GetUserProfileAsync(effectiveUserId);
            var invoicePrefix = !string.IsNullOrEmpty(userProfile?.InvoicePrefix) 
                ? userProfile.InvoicePrefix 
                : "INV"; // Default fallback

            // Invoice number: use provided one if valid, otherwise auto-generate (FY based on invoice date)
            string invoiceNumber;
            if (!string.IsNullOrWhiteSpace(createInvoiceDto.InvoiceNumber))
            {
                var providedNumber = createInvoiceDto.InvoiceNumber.Trim();
                if (await _invoiceRepository.InvoiceNumberExistsAsync(effectiveUserId, providedNumber))
                    throw new ArgumentException("Invoice number already exists. Please use a different number.");
                invoiceNumber = providedNumber;
            }
            else
            {
                invoiceNumber = await _invoiceRepository.GenerateInvoiceNumberAsync(effectiveUserId, invoicePrefix, invoiceDate);
            }

            NormalizeInvoiceItems(createInvoiceDto.Items);
            var invoiceItems = InvoiceCalculationHelper.BuildInvoiceItems(createInvoiceDto.Items);
            var totals = InvoiceCalculationHelper.CalculateInvoiceTotals(createInvoiceDto.Items);
            var grandTotal = totals.GrandTotal;

            // Base invoice object
            var invoice = new Invoice
            {
                InvoiceNumber = invoiceNumber,
                UserId = effectiveUserId,
                CustomerId = createInvoiceDto.CustomerId,
                InvoiceDate = invoiceDate,
                DueDate = createInvoiceDto.DueDate,
                TotalAmount = totals.TotalAmount,
                GstPercentage = createInvoiceDto.Items.FirstOrDefault()?.GstPercentage ?? 0,
                GstAmount = totals.GstAmount,
                Cgst = totals.Cgst,
                Sgst = totals.Sgst,
                GrandTotal = grandTotal,
                BalanceAmount = grandTotal,
                Status = createInvoiceDto.Status ?? "Unpaid", // Default to Unpaid
                WorkStatus = "Pending",
                InvoiceItems = invoiceItems
            };

            // ✅ Handle initial payment (fix)
            if (createInvoiceDto.InitialPayment > 0)
            {
                var initialPayment = Math.Min(createInvoiceDto.InitialPayment, grandTotal);
                invoice.PaidAmount = initialPayment;
                invoice.WaveAmount = 0; // No wave on initial payment
                invoice.BalanceAmount = grandTotal - initialPayment;
                
                // Round to 2 decimal places to avoid floating point precision issues
                invoice.BalanceAmount = Math.Round(invoice.BalanceAmount, 2);
                
                // If balance is very close to zero (within 0.01), set it to zero
                if (Math.Abs(invoice.BalanceAmount) < 0.01m)
                {
                    invoice.BalanceAmount = 0;
                }

                invoice.Payments.Add(new Payment
                {
                    AmountPaid = initialPayment,
                    WaveAmount = 0,
                    PaymentDate = DateTime.UtcNow,
                    PaymentMode = "Initial",
                    Remarks = "Initial payment at invoice creation"
                });

                if (invoice.BalanceAmount <= 0)
                {
                    invoice.Status = "Paid";
                    invoice.BalanceAmount = 0; // Ensure balance is exactly 0 when paid
                }
                else if (invoice.BalanceAmount < invoice.GrandTotal)
                    invoice.Status = "Partially Paid";
                else
                    invoice.Status = "Unpaid";
            }

            // Snapshot seller/company info at creation - invoice always shows creator's details as they were when created
            invoice.SellerInfoSnapshot = userProfile != null
                ? JsonSerializer.Serialize(new InvoiceSellerInfoDto
                {
                    Name = userProfile.Name,
                    Email = userProfile.Email,
                    BusinessName = userProfile.BusinessName,
                    GstNumber = userProfile.GstNumber,
                    Address = userProfile.Address,
                    BankName = userProfile.BankName,
                    BankAccountNo = userProfile.BankAccountNo,
                    IfscCode = userProfile.IfscCode,
                    PanNumber = userProfile.PanNumber,
                    MembershipNo = userProfile.MembershipNo,
                    GstpNumber = userProfile.GstpNumber,
                    City = userProfile.City,
                    State = userProfile.State,
                    Zip = userProfile.Zip,
                    Phone = userProfile.Phone,
                    LogoUrl = userProfile.LogoUrl,
                    SignatureUrl = userProfile.SignatureUrl,
                    IncludeSignatureOnInvoice = userProfile.IncludeSignatureOnInvoice,
                    IncludeLogoOnInvoice = userProfile.IncludeLogoOnInvoice,
                    HeaderLogoBgColor = userProfile.HeaderLogoBgColor,
                    AddressSectionBgColor = userProfile.AddressSectionBgColor,
                    HeaderLogoTextColor = userProfile.HeaderLogoTextColor,
                    AddressSectionTextColor = userProfile.AddressSectionTextColor,
                    InvoiceHeaderFontSize = userProfile.InvoiceHeaderFontSize,
                    AddressSectionFontSize = userProfile.AddressSectionFontSize,
                    UseDefaultInvoiceFontSizes = userProfile.UseDefaultInvoiceFontSizes,
                    GpayNumber = userProfile.GpayNumber,
                    TaxPractitionerTitle = userProfile.TaxPractitionerTitle,
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })
                : null;

            var createdInvoice = await _invoiceRepository.AddAsync(invoice);

            // Save products to catalog for autocomplete
            await _productService.UpsertProductsFromInvoiceAsync(effectiveUserId,
                createInvoiceDto.Items.Select(i => (i.ProductName, i.Rate, i.GstPercentage)));

            // Update customer total balance
            if (customer != null)
            {
                var newBalance = (await _invoiceRepository.GetByUserIdAsync(effectiveUserId))
                    .Where(i => i.CustomerId == customer.Id)
                    .Sum(i => i.BalanceAmount);

                await _customerRepository.UpdateCustomerBalanceAsync(customer.Id, newBalance);
            }

            return _mapper.Map<InvoiceDto>(createdInvoice);
        }

        // -----------------------------------------------
        // Get user invoices
        // -----------------------------------------------
        public async Task<List<InvoiceDto>> GetUserInvoicesAsync(Guid userId)
        {
            var invoices = await _invoiceRepository.GetByUserIdAsync(userId);
            return _mapper.Map<List<InvoiceDto>>(invoices);
        }

        // -----------------------------------------------
        // Get admin invoices (from all users created by admin)
        // -----------------------------------------------
        public async Task<List<InvoiceDto>> GetAdminInvoicesAsync(Guid adminId)
        {
            var invoices = await _invoiceRepository.GetByAdminIdAsync(adminId);
            return _mapper.Map<List<InvoiceDto>>(invoices);
        }

        // -----------------------------------------------
        // Get all invoices (for MasterUser)
        // -----------------------------------------------
        public async Task<List<InvoiceDto>> GetAllInvoicesAsync()
        {
            var invoices = await _invoiceRepository.GetAllAsync();
            return _mapper.Map<List<InvoiceDto>>(invoices);
        }

        // -----------------------------------------------
        // Get single invoice
        // -----------------------------------------------
        public async Task<InvoiceDto?> GetInvoiceByIdAsync(int id, Guid userId, string? userRole = null)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(id);
            if (invoice == null)
                return null;

            // MasterUser can view any invoice
            if (userRole == "MasterUser")
            {
                return _mapper.Map<InvoiceDto>(invoice);
            }

            // Admin can view invoices from users they created or their own
            if (userRole == "Admin")
            {
                // Check if invoice belongs to admin or a user created by admin
                if (invoice.UserId == userId)
                {
                    return _mapper.Map<InvoiceDto>(invoice);
                }

                // Check if invoice user was created by this admin
                var invoiceUser = invoice.User;
                if (invoiceUser != null && invoiceUser.CreatedBy == userId)
                {
                    return _mapper.Map<InvoiceDto>(invoice);
                }

                return null; // Not authorized
            }

            // Regular user can only view their own invoices
            if (invoice.UserId != userId)
                return null;

            return _mapper.Map<InvoiceDto>(invoice);
        }

        // -----------------------------------------------
        // Add payment (with overpayment protection)
        // -----------------------------------------------
        public async Task<bool> AddPaymentAsync(int invoiceId, Guid userId, PaymentDto paymentDto, string? userRole = null)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                return false;

            if (!CanManagePayments(invoice, userId, userRole))
                return false;

            // Calculate total deduction (amount paid + wave amount)
            var totalDeduction = paymentDto.AmountPaid + paymentDto.WaveAmount;
            
            // Prevent overpayment (including wave amount)
            if (invoice.PaidAmount + totalDeduction > invoice.GrandTotal)
            {
                var maxAllowed = invoice.GrandTotal - invoice.PaidAmount;
                // Distribute the max allowed between amount paid and wave
                if (maxAllowed <= 0)
                {
                    return false; // Already fully paid
                }
                // If wave amount is specified, prioritize it
                if (paymentDto.WaveAmount > 0 && paymentDto.WaveAmount <= maxAllowed)
                {
                    paymentDto.AmountPaid = Math.Max(0, maxAllowed - paymentDto.WaveAmount);
                }
                else
                {
                    paymentDto.AmountPaid = maxAllowed;
                    paymentDto.WaveAmount = 0;
                }
                totalDeduction = paymentDto.AmountPaid + paymentDto.WaveAmount;
            }

            // Create payment record
            var payment = new Payment
            {
                InvoiceId = invoiceId,
                AmountPaid = paymentDto.AmountPaid,
                WaveAmount = paymentDto.WaveAmount,
                PaymentDate = DateTime.UtcNow,
                PaymentMode = paymentDto.PaymentMode,
                Remarks = paymentDto.Remarks
            };

            invoice.Payments.Add(payment);
            RecalculateInvoicePaymentTotals(invoice);
            await UpdateCustomerBalanceForInvoiceAsync(invoice, userId);
            await _invoiceRepository.UpdateAsync(invoice);
            return true;
        }

        // -----------------------------------------------
        // Update payment (partial payments only)
        // -----------------------------------------------
        public async Task<bool> UpdatePaymentAsync(int invoiceId, int paymentId, Guid userId, UpdatePaymentDto paymentDto, string? userRole = null)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                return false;

            if (!CanManagePayments(invoice, userId, userRole))
                return false;

            var payment = invoice.Payments.FirstOrDefault(p => p.Id == paymentId);
            if (payment == null)
                return false;

            var isPartialPaymentScenario = invoice.Status == "Partially Paid" || invoice.Payments.Count > 1;
            if (!isPartialPaymentScenario)
                throw new InvalidOperationException("Payment can only be edited for partially paid invoices.");

            if (paymentDto.AmountPaid < 0 || paymentDto.WaveAmount < 0)
                throw new InvalidOperationException("Payment amounts cannot be negative.");

            if (paymentDto.AmountPaid + paymentDto.WaveAmount <= 0)
                throw new InvalidOperationException("Payment amount or wave must be greater than zero.");

            var otherPaid = invoice.Payments.Where(p => p.Id != paymentId).Sum(p => p.AmountPaid);
            var otherWave = invoice.Payments.Where(p => p.Id != paymentId).Sum(p => p.WaveAmount);
            var newTotal = otherPaid + otherWave + paymentDto.AmountPaid + paymentDto.WaveAmount;

            if (newTotal > invoice.GrandTotal)
            {
                var maxAllowed = invoice.GrandTotal - otherPaid - otherWave;
                throw new InvalidOperationException(
                    $"Total payments cannot exceed invoice amount (₹{invoice.GrandTotal:F2}). Maximum allowed for this payment: ₹{maxAllowed:F2}");
            }

            payment.AmountPaid = paymentDto.AmountPaid;
            payment.WaveAmount = paymentDto.WaveAmount;
            payment.PaymentMode = paymentDto.PaymentMode;
            payment.Remarks = paymentDto.Remarks;
            payment.UpdatedAt = DateTime.UtcNow;

            RecalculateInvoicePaymentTotals(invoice);
            await UpdateCustomerBalanceForInvoiceAsync(invoice, userId);
            await _invoiceRepository.UpdateAsync(invoice);
            return true;
        }

        // -----------------------------------------------
        // Update Invoice
        // -----------------------------------------------
        public async Task<InvoiceDto> UpdateInvoiceAsync(int invoiceId, Guid userId, UpdateInvoiceDto updateInvoiceDto, string? userRole = null)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                throw new ArgumentException("Invoice not found");

            // Check permissions
            bool canUpdate = false;
            if (userRole == "MasterUser")
            {
                canUpdate = true;
            }
            else if (userRole == "Admin")
            {
                if (invoice.UserId == userId || (invoice.User != null && invoice.User.CreatedBy == userId))
                {
                    canUpdate = true;
                }
            }
            else if (invoice.UserId == userId)
            {
                canUpdate = true;
            }

            if (!canUpdate)
                throw new UnauthorizedAccessException("You don't have permission to update this invoice");

            // Don't allow updating if invoice has payments (to maintain data integrity)
            if (invoice.Payments.Any() && invoice.Payments.Count > 0)
            {
                throw new InvalidOperationException("Cannot update invoice that has payments. Please delete payments first or create a new invoice.");
            }

            // Validate customer belongs to user
            var customer = await _customerRepository.GetCustomerByIdAsync(updateInvoiceDto.CustomerId, userId);
            if (customer == null || customer.UserId != userId)
                throw new ArgumentException("Customer not found");

            // Update customer if changed
            if (invoice.CustomerId != updateInvoiceDto.CustomerId)
            {
                invoice.CustomerId = updateInvoiceDto.CustomerId;
            }

            // Update due date
            invoice.DueDate = updateInvoiceDto.DueDate;

            // Remove old items
            invoice.InvoiceItems.Clear();

            NormalizeInvoiceItems(updateInvoiceDto.Items);
            var updatedItems = InvoiceCalculationHelper.BuildInvoiceItems(updateInvoiceDto.Items);
            foreach (var item in updatedItems)
                invoice.InvoiceItems.Add(item);

            var totals = InvoiceCalculationHelper.CalculateInvoiceTotals(updateInvoiceDto.Items);
            invoice.TotalAmount = totals.TotalAmount;
            invoice.GstAmount = totals.GstAmount;
            invoice.Cgst = totals.Cgst;
            invoice.Sgst = totals.Sgst;
            invoice.GrandTotal = totals.GrandTotal;
            invoice.GstPercentage = updateInvoiceDto.Items.FirstOrDefault()?.GstPercentage ?? 0;

            // Save products to catalog for autocomplete
            await _productService.UpsertProductsFromInvoiceAsync(invoice.UserId,
                updateInvoiceDto.Items.Select(i => (i.ProductName, i.Rate, i.GstPercentage)));

            // Reset payment amounts (since we're recalculating)
            invoice.PaidAmount = 0;
            invoice.WaveAmount = 0;
            invoice.BalanceAmount = invoice.GrandTotal;
            
            // Set status - if updating to Draft or Sent, keep it; otherwise set based on payment
            if (updateInvoiceDto.Status == "Draft" || updateInvoiceDto.Status == "Sent")
            {
                invoice.Status = updateInvoiceDto.Status;
            }
            else
            {
                invoice.Status = "Unpaid"; // Default to Unpaid when updating
            }

            await _invoiceRepository.UpdateAsync(invoice);

            // Update customer balance
            if (customer != null)
            {
                var newBalance = (await _invoiceRepository.GetByUserIdAsync(userId))
                    .Where(i => i.CustomerId == customer.Id)
                    .Sum(i => i.BalanceAmount);

                await _customerRepository.UpdateCustomerBalanceAsync(customer.Id, newBalance);
            }

            return _mapper.Map<InvoiceDto>(invoice);
        }

        // -----------------------------------------------
        // Update Invoice Date only
        // -----------------------------------------------
        public async Task<InvoiceDto> UpdateInvoiceDateAsync(
            int invoiceId, Guid userId, UpdateInvoiceDateDto dto, string? userRole = null)
        {
            if (userRole == "MasterUser")
                throw new UnauthorizedAccessException("MasterUser cannot update invoices.");

            if (string.IsNullOrWhiteSpace(dto.InvoiceDate) || !DateTime.TryParse(dto.InvoiceDate, out var parsedDate))
                throw new ArgumentException("Invalid invoice date. Use YYYY-MM-DD.");

            if (parsedDate.Date > DateTime.Today)
                throw new ArgumentException("Invoice date cannot be in the future.");

            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                throw new ArgumentException("Invoice not found");

            if (!CanModifyInvoice(invoice, userId, userRole))
                throw new UnauthorizedAccessException("You don't have permission to update this invoice");

            invoice.InvoiceDate = parsedDate.Date;
            await _invoiceRepository.UpdateAsync(invoice);

            return _mapper.Map<InvoiceDto>(invoice);
        }

        public async Task<InvoiceDto> UpdateWorkStatusAsync(
            int invoiceId, Guid userId, UpdateWorkStatusDto dto, string? userRole = null)
        {
            if (userRole == "MasterUser")
                throw new UnauthorizedAccessException("MasterUser cannot update invoices.");

            var workStatus = dto.WorkStatus?.Trim();
            if (string.IsNullOrEmpty(workStatus) ||
                !new[] { "Pending", "In Progress", "Completed" }.Contains(workStatus))
            {
                throw new ArgumentException("Invalid work status. Use Pending, In Progress, or Completed.");
            }

            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                throw new ArgumentException("Invoice not found");

            if (!CanModifyInvoice(invoice, userId, userRole))
                throw new UnauthorizedAccessException("You don't have permission to update this invoice");

            invoice.WorkStatus = workStatus;
            await _invoiceRepository.UpdateAsync(invoice);

            return _mapper.Map<InvoiceDto>(invoice);
        }

        private static bool CanModifyInvoice(Invoice invoice, Guid userId, string? userRole)
        {
            if (userRole == "MasterUser")
                return true;

            if (userRole == "Admin")
                return invoice.UserId == userId || (invoice.User != null && invoice.User.CreatedBy == userId);

            return invoice.UserId == userId;
        }

        // -----------------------------------------------
        // Delete Invoice
        // -----------------------------------------------
        public async Task<bool> DeleteInvoiceAsync(int invoiceId, Guid userId, string? userRole = null)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null)
                return false;

            // Check permissions
            bool canDelete = false;
            if (userRole == "MasterUser")
            {
                canDelete = true;
            }
            else if (userRole == "Admin")
            {
                if (invoice.UserId == userId || (invoice.User != null && invoice.User.CreatedBy == userId))
                {
                    canDelete = true;
                }
            }
            else if (invoice.UserId == userId)
            {
                canDelete = true;
            }

            if (!canDelete)
                return false;

            // Store customer ID before deletion for balance update
            var customerId = invoice.CustomerId;

            // Delete invoice (this will cascade delete items and payments)
            var deleted = await _invoiceRepository.DeleteAsync(invoiceId);
            
            if (deleted)
            {
                // Update customer balance
                var customer = await _customerRepository.GetCustomerByIdAsync(customerId, userId);
                if (customer != null)
                {
                    var newBalance = (await _invoiceRepository.GetByUserIdAsync(userId))
                        .Where(i => i.CustomerId == customerId)
                        .Sum(i => i.BalanceAmount);

                    await _customerRepository.UpdateCustomerBalanceAsync(customerId, newBalance);
                }
            }

            return deleted;
        }

        // -----------------------------------------------
        // Duplicate Invoice
        // -----------------------------------------------
        public async Task<InvoiceDto> DuplicateInvoiceAsync(int invoiceId, Guid userId, string? userRole = null)
        {
            var originalInvoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (originalInvoice == null)
                throw new ArgumentException("Invoice not found");

            // Check permissions
            bool canDuplicate = false;
            if (userRole == "MasterUser")
            {
                canDuplicate = true;
            }
            else if (userRole == "Admin")
            {
                if (originalInvoice.UserId == userId || (originalInvoice.User != null && originalInvoice.User.CreatedBy == userId))
                {
                    canDuplicate = true;
                }
            }
            else if (originalInvoice.UserId == userId)
            {
                canDuplicate = true;
            }

            if (!canDuplicate)
                throw new UnauthorizedAccessException("You don't have permission to duplicate this invoice");

            // Get user's invoice prefix
            var userProfile = await _userService.GetUserProfileAsync(userId);
            var invoicePrefix = !string.IsNullOrEmpty(userProfile?.InvoicePrefix) 
                ? userProfile.InvoicePrefix 
                : "INV";

            // Generate new invoice number
            var invoiceNumber = await _invoiceRepository.GenerateInvoiceNumberAsync(userId, invoicePrefix);

            // Create new invoice with same data but new number and date
            var newInvoice = new Invoice
            {
                InvoiceNumber = invoiceNumber,
                UserId = userId,
                CustomerId = originalInvoice.CustomerId,
                InvoiceDate = DateTime.UtcNow,
                DueDate = originalInvoice.DueDate,
                TotalAmount = originalInvoice.TotalAmount,
                GstPercentage = originalInvoice.GstPercentage,
                GstAmount = originalInvoice.GstAmount,
                Cgst = originalInvoice.Cgst,
                Sgst = originalInvoice.Sgst,
                GrandTotal = originalInvoice.GrandTotal,
                PaidAmount = 0,
                WaveAmount = 0,
                BalanceAmount = originalInvoice.GrandTotal,
                Status = "Unpaid",
                WorkStatus = "Pending",
                InvoiceItems = DuplicateInvoiceItems(originalInvoice.InvoiceItems)
            };

            // Snapshot seller info at duplication (duplicator's current profile)
            newInvoice.SellerInfoSnapshot = userProfile != null
                ? JsonSerializer.Serialize(new InvoiceSellerInfoDto
                {
                    Name = userProfile.Name,
                    Email = userProfile.Email,
                    BusinessName = userProfile.BusinessName,
                    GstNumber = userProfile.GstNumber,
                    Address = userProfile.Address,
                    BankName = userProfile.BankName,
                    BankAccountNo = userProfile.BankAccountNo,
                    IfscCode = userProfile.IfscCode,
                    PanNumber = userProfile.PanNumber,
                    MembershipNo = userProfile.MembershipNo,
                    GstpNumber = userProfile.GstpNumber,
                    City = userProfile.City,
                    State = userProfile.State,
                    Zip = userProfile.Zip,
                    Phone = userProfile.Phone,
                    LogoUrl = userProfile.LogoUrl,
                    SignatureUrl = userProfile.SignatureUrl,
                    IncludeSignatureOnInvoice = userProfile.IncludeSignatureOnInvoice,
                    IncludeLogoOnInvoice = userProfile.IncludeLogoOnInvoice,
                    HeaderLogoBgColor = userProfile.HeaderLogoBgColor,
                    AddressSectionBgColor = userProfile.AddressSectionBgColor,
                    HeaderLogoTextColor = userProfile.HeaderLogoTextColor,
                    AddressSectionTextColor = userProfile.AddressSectionTextColor,
                    InvoiceHeaderFontSize = userProfile.InvoiceHeaderFontSize,
                    AddressSectionFontSize = userProfile.AddressSectionFontSize,
                    UseDefaultInvoiceFontSizes = userProfile.UseDefaultInvoiceFontSizes,
                    GpayNumber = userProfile.GpayNumber,
                    TaxPractitionerTitle = userProfile.TaxPractitionerTitle,
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })
                : null;

            var createdInvoice = await _invoiceRepository.AddAsync(newInvoice);

            // Update customer balance
            var customer = await _customerRepository.GetCustomerByIdAsync(originalInvoice.CustomerId, userId);
            if (customer != null)
            {
                var newBalance = (await _invoiceRepository.GetByUserIdAsync(userId))
                    .Where(i => i.CustomerId == customer.Id)
                    .Sum(i => i.BalanceAmount);

                await _customerRepository.UpdateCustomerBalanceAsync(customer.Id, newBalance);
            }

            return _mapper.Map<InvoiceDto>(createdInvoice);
        }

        private static bool CanManagePayments(Invoice invoice, Guid userId, string? userRole)
        {
            if (userRole == "MasterUser")
                return true;

            if (userRole == "Admin")
            {
                if (invoice.UserId == userId)
                    return true;
                if (invoice.User != null && invoice.User.CreatedBy == userId)
                    return true;
                return false;
            }

            return invoice.UserId == userId;
        }

        private static void RecalculateInvoicePaymentTotals(Invoice invoice)
        {
            invoice.PaidAmount = Math.Round(invoice.Payments.Sum(p => p.AmountPaid), 2);
            invoice.WaveAmount = Math.Round(invoice.Payments.Sum(p => p.WaveAmount), 2);
            invoice.BalanceAmount = Math.Round(invoice.GrandTotal - (invoice.PaidAmount + invoice.WaveAmount), 2);

            if (Math.Abs(invoice.BalanceAmount) < 0.01m)
                invoice.BalanceAmount = 0;

            if (invoice.Status != "Draft" && invoice.Status != "Sent")
            {
                if (invoice.BalanceAmount <= 0)
                {
                    invoice.Status = "Paid";
                    invoice.BalanceAmount = 0;
                }
                else if (invoice.PaidAmount > 0 || invoice.WaveAmount > 0)
                    invoice.Status = "Partially Paid";
                else
                    invoice.Status = "Unpaid";
            }
        }

        private async Task UpdateCustomerBalanceForInvoiceAsync(Invoice invoice, Guid userId)
        {
            var customer = await _customerRepository.GetCustomerByIdAsync(invoice.CustomerId, userId);
            if (customer == null)
                return;

            var newBalance = (await _invoiceRepository.GetByUserIdAsync(invoice.UserId))
                .Where(i => i.CustomerId == customer.Id)
                .Sum(i => i.BalanceAmount);

            await _customerRepository.UpdateCustomerBalanceAsync(invoice.CustomerId, newBalance);
        }

        private static void NormalizeInvoiceItems(List<InvoiceItemDto> items)
        {
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (item.DisplayOrder <= 0)
                    item.DisplayOrder = i + 1;

                if (string.IsNullOrWhiteSpace(item.ParentLineKey) && !item.ParentInvoiceItemId.HasValue)
                    item.HierarchyLevel = 0;
                else if (!string.IsNullOrWhiteSpace(item.ParentLineKey))
                {
                    item.HierarchyLevel = Math.Max(item.HierarchyLevel, 1);
                }
            }
        }

        private static List<InvoiceItem> DuplicateInvoiceItems(ICollection<InvoiceItem> sourceItems)
        {
            var parents = sourceItems.Where(i => i.ParentInvoiceItemId == null).OrderBy(i => i.DisplayOrder).ToList();
            var children = sourceItems.Where(i => i.ParentInvoiceItemId != null).OrderBy(i => i.DisplayOrder).ToList();
            var idMap = new Dictionary<int, InvoiceItem>();
            var result = new List<InvoiceItem>();

            foreach (var item in parents)
            {
                var copy = CopyInvoiceItem(item);
                result.Add(copy);
                idMap[item.Id] = copy;
            }

            foreach (var item in children)
            {
                var copy = CopyInvoiceItem(item);
                if (item.ParentInvoiceItemId.HasValue &&
                    idMap.TryGetValue(item.ParentInvoiceItemId.Value, out var parent))
                {
                    copy.ParentInvoiceItem = parent;
                }
                result.Add(copy);
            }

            return result;
        }

        private static InvoiceItem CopyInvoiceItem(InvoiceItem item) => new()
        {
            ProductId = item.ProductId,
            ProductName = item.ProductName,
            Quantity = item.Quantity,
            Rate = item.Rate,
            Amount = item.Amount,
            GstPercentage = item.GstPercentage,
            GstAmount = item.GstAmount,
            Cgst = item.Cgst,
            Sgst = item.Sgst,
            HierarchyLevel = item.HierarchyLevel,
            AffectTotal = item.AffectTotal,
            Taxable = item.Taxable,
            DisplayOrder = item.DisplayOrder,
            ShowOnInvoice = item.ShowOnInvoice
        };
    }
}
