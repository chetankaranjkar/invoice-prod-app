using System;
using System.Collections.Generic;
using System.Linq;
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
        private readonly IMapper _mapper;

        public InvoiceService(
            IInvoiceRepository invoiceRepository,
            ICustomerRepository customerRepository,
            IUserService userService,
            IMapper mapper)
        {
            _invoiceRepository = invoiceRepository;
            _customerRepository = customerRepository;
            _userService = userService;
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

            // Validate customer belongs to user
            var customer = await _customerRepository.GetCustomerByIdAsync(createInvoiceDto.CustomerId,userId);
            if (customer == null || customer.UserId != userId)
                throw new ArgumentException("Customer not found");

            // Get user's invoice prefix from user profile (DTO prefix is ignored, using user's stored prefix)
            var userProfile = await _userService.GetUserProfileAsync(userId);
            var invoicePrefix = !string.IsNullOrEmpty(userProfile?.InvoicePrefix) 
                ? userProfile.InvoicePrefix 
                : "INV"; // Default fallback

            // Generate invoice number using user's prefix
            var invoiceNumber = await _invoiceRepository.GenerateInvoiceNumberAsync(userId, invoicePrefix);

            // Calculate item totals
            var invoiceItems = new List<InvoiceItem>();
            decimal totalAmount = 0;
            decimal totalGst = 0;

            foreach (var itemDto in createInvoiceDto.Items)
            {
                var amount = itemDto.Quantity * itemDto.Rate;
                var gstAmount = amount * (itemDto.GstPercentage / 100);
                var cgst = gstAmount / 2;
                var sgst = gstAmount / 2;

                invoiceItems.Add(new InvoiceItem
                {
                    ProductName = itemDto.ProductName,
                    Quantity = itemDto.Quantity,
                    Rate = itemDto.Rate,
                    Amount = amount,
                    GstPercentage = itemDto.GstPercentage,
                    GstAmount = gstAmount,
                    Cgst = cgst,
                    Sgst = sgst
                });

                totalAmount += amount;
                totalGst += gstAmount;
            }

            var grandTotal = totalAmount + totalGst;

            // Base invoice object
            var invoice = new Invoice
            {
                InvoiceNumber = invoiceNumber,
                UserId = userId,
                CustomerId = createInvoiceDto.CustomerId,
                InvoiceDate = DateTime.UtcNow,
                DueDate = createInvoiceDto.DueDate,
                TotalAmount = totalAmount,
                GstPercentage = createInvoiceDto.Items.First().GstPercentage,
                GstAmount = totalGst,
                Cgst = totalGst / 2,
                Sgst = totalGst / 2,
                GrandTotal = grandTotal,
                BalanceAmount = grandTotal,
                Status = createInvoiceDto.Status ?? "Unpaid", // Default to Unpaid
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

            var createdInvoice = await _invoiceRepository.AddAsync(invoice);

            // Update customer total balance
            if (customer != null)
            {
                var newBalance = (await _invoiceRepository.GetByUserIdAsync(userId))
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

            // Check permissions
            bool canAddPayment = false;
            if (userRole == "MasterUser")
            {
                canAddPayment = true; // MasterUser can add payment to any invoice
            }
            else if (userRole == "Admin")
            {
                // Admin can add payment to invoices from users they created or their own
                if (invoice.UserId == userId)
                {
                    canAddPayment = true;
                }
                else if (invoice.User != null && invoice.User.CreatedBy == userId)
                {
                    canAddPayment = true;
                }
            }
            else if (invoice.UserId == userId)
            {
                canAddPayment = true; // Regular user can add payment to their own invoices
            }

            if (!canAddPayment)
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
            // Update paid amount and wave amount separately
            invoice.PaidAmount += paymentDto.AmountPaid;
            invoice.WaveAmount += paymentDto.WaveAmount;
            
            // Round paid and wave amounts to avoid precision issues
            invoice.PaidAmount = Math.Round(invoice.PaidAmount, 2);
            invoice.WaveAmount = Math.Round(invoice.WaveAmount, 2);
            
            // Recalculate balance from all payments to ensure accuracy
            var totalPaidFromPayments = invoice.Payments.Sum(p => p.AmountPaid);
            var totalWaveFromPayments = invoice.Payments.Sum(p => p.WaveAmount);
            
            // Use the sum from payments to ensure consistency
            invoice.PaidAmount = Math.Round(totalPaidFromPayments, 2);
            invoice.WaveAmount = Math.Round(totalWaveFromPayments, 2);
            
            // Balance = GrandTotal - (PaidAmount + WaveAmount)
            invoice.BalanceAmount = invoice.GrandTotal - (invoice.PaidAmount + invoice.WaveAmount);
            
            // Round to 2 decimal places to avoid floating point precision issues
            invoice.BalanceAmount = Math.Round(invoice.BalanceAmount, 2);
            
            // If balance is very close to zero (within 0.01), set it to zero
            if (Math.Abs(invoice.BalanceAmount) < 0.01m)
            {
                invoice.BalanceAmount = 0;
            }

            // Update status - don't change if it's Draft or Sent, otherwise update based on payment
            if (invoice.Status != "Draft" && invoice.Status != "Sent")
            {
                if (invoice.BalanceAmount <= 0)
                {
                    invoice.Status = "Paid";
                    invoice.BalanceAmount = 0; // Ensure balance is exactly 0 when paid
                }
                else if (invoice.PaidAmount > 0)
                    invoice.Status = "Partially Paid";
                else
                    invoice.Status = "Unpaid";
            }

            // Update customer balance
            var customer = await _customerRepository.GetCustomerByIdAsync(invoice.CustomerId,userId);
            if (customer != null)
            {
                var newBalance = (await _invoiceRepository.GetByUserIdAsync(userId))
                    .Where(i => i.CustomerId == customer.Id)
                    .Sum(i => i.BalanceAmount);

                await _customerRepository.UpdateCustomerBalanceAsync(invoice.CustomerId, newBalance);
            }

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

            // Calculate new item totals
            decimal totalAmount = 0;
            decimal totalGst = 0;

            foreach (var itemDto in updateInvoiceDto.Items)
            {
                var amount = itemDto.Quantity * itemDto.Rate;
                var gstAmount = amount * (itemDto.GstPercentage / 100);
                var cgst = gstAmount / 2;
                var sgst = gstAmount / 2;

                invoice.InvoiceItems.Add(new InvoiceItem
                {
                    ProductName = itemDto.ProductName,
                    Quantity = itemDto.Quantity,
                    Rate = itemDto.Rate,
                    Amount = amount,
                    GstPercentage = itemDto.GstPercentage,
                    GstAmount = gstAmount,
                    Cgst = cgst,
                    Sgst = sgst
                });

                totalAmount += amount;
                totalGst += gstAmount;
            }

            // Update totals
            invoice.TotalAmount = totalAmount;
            invoice.GstAmount = totalGst;
            invoice.Cgst = totalGst / 2;
            invoice.Sgst = totalGst / 2;
            invoice.GrandTotal = totalAmount + totalGst;
            invoice.GstPercentage = updateInvoiceDto.Items.FirstOrDefault()?.GstPercentage ?? 0;

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
                InvoiceItems = originalInvoice.InvoiceItems.Select(item => new InvoiceItem
                {
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    Rate = item.Rate,
                    Amount = item.Amount,
                    GstPercentage = item.GstPercentage,
                    GstAmount = item.GstAmount,
                    Cgst = item.Cgst,
                    Sgst = item.Sgst
                }).ToList()
            };

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
    }
}
