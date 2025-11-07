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
        private readonly IMapper _mapper;

        public InvoiceService(
            IInvoiceRepository invoiceRepository,
            ICustomerRepository customerRepository,
            IMapper mapper)
        {
            _invoiceRepository = invoiceRepository;
            _customerRepository = customerRepository;
            _mapper = mapper;
        }

        // -----------------------------------------------
        // Create Invoice (with optional initial payment)
        // -----------------------------------------------
        public async Task<InvoiceDto> CreateInvoiceAsync(Guid userId, CreateInvoiceDto createInvoiceDto)
        {
            // Validate customer belongs to user
            var customer = await _customerRepository.GetCustomerByIdAsync(createInvoiceDto.CustomerId,userId);
            if (customer == null || customer.UserId != userId)
                throw new ArgumentException("Customer not found");

            // Generate invoice number
            var invoiceNumber = await _invoiceRepository.GenerateInvoiceNumberAsync(userId, createInvoiceDto.InvoicePrefix);

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
                Status = "Unpaid",
                InvoiceItems = invoiceItems
            };

            // ✅ Handle initial payment (fix)
            if (createInvoiceDto.InitialPayment > 0)
            {
                var initialPayment = Math.Min(createInvoiceDto.InitialPayment, grandTotal);
                invoice.PaidAmount = initialPayment;
                invoice.BalanceAmount = grandTotal - initialPayment;

                invoice.Payments.Add(new Payment
                {
                    AmountPaid = initialPayment,
                    PaymentDate = DateTime.UtcNow,
                    PaymentMode = "Initial",
                    Remarks = "Initial payment at invoice creation"
                });

                if (invoice.BalanceAmount <= 0)
                    invoice.Status = "Paid";
                else
                    invoice.Status = "Partially Paid";
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
        // Get single invoice
        // -----------------------------------------------
        public async Task<InvoiceDto?> GetInvoiceByIdAsync(int id, Guid userId)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(id);
            if (invoice == null || invoice.UserId != userId)
                return null;

            return _mapper.Map<InvoiceDto>(invoice);
        }

        // -----------------------------------------------
        // Add payment (with overpayment protection)
        // -----------------------------------------------
        public async Task<bool> AddPaymentAsync(int invoiceId, Guid userId, PaymentDto paymentDto)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId);
            if (invoice == null || invoice.UserId != userId)
                return false;

            // Prevent overpayment
            if (invoice.PaidAmount + paymentDto.AmountPaid > invoice.GrandTotal)
                paymentDto.AmountPaid = invoice.GrandTotal - invoice.PaidAmount;

            // Create payment record
            var payment = new Payment
            {
                InvoiceId = invoiceId,
                AmountPaid = paymentDto.AmountPaid,
                PaymentDate = DateTime.UtcNow,
                PaymentMode = paymentDto.PaymentMode,
                Remarks = paymentDto.Remarks
            };

            invoice.Payments.Add(payment);
            invoice.PaidAmount += paymentDto.AmountPaid;
            invoice.BalanceAmount = invoice.GrandTotal - invoice.PaidAmount;

            // Update status
            if (invoice.BalanceAmount <= 0)
                invoice.Status = "Paid";
            else if (invoice.PaidAmount > 0)
                invoice.Status = "Partially Paid";
            else
                invoice.Status = "Unpaid";

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
    }
}
