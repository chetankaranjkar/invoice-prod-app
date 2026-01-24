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
    public class RecurringInvoiceService : IRecurringInvoiceService
    {
        private readonly IRecurringInvoiceRepository _recurringInvoiceRepository;
        private readonly IInvoiceService _invoiceService;
        private readonly ICustomerRepository _customerRepository;
        private readonly IUserService _userService;
        private readonly IMapper _mapper;

        public RecurringInvoiceService(
            IRecurringInvoiceRepository recurringInvoiceRepository,
            IInvoiceService invoiceService,
            ICustomerRepository customerRepository,
            IUserService userService,
            IMapper mapper)
        {
            _recurringInvoiceRepository = recurringInvoiceRepository;
            _invoiceService = invoiceService;
            _customerRepository = customerRepository;
            _userService = userService;
            _mapper = mapper;
        }

        public async Task<RecurringInvoiceDto> CreateRecurringInvoiceAsync(Guid userId, CreateRecurringInvoiceDto createDto)
        {
            // Validate customer belongs to user
            var customer = await _customerRepository.GetCustomerByIdAsync(createDto.CustomerId, userId);
            if (customer == null || customer.UserId != userId)
                throw new ArgumentException("Customer not found");

            // Calculate next generation date
            var nextGenDate = CalculateNextGenerationDate(createDto.StartDate, createDto.Frequency, createDto.DayOfMonth);

            var recurringInvoice = new RecurringInvoice
            {
                Name = createDto.Name,
                UserId = userId,
                CustomerId = createDto.CustomerId,
                Frequency = createDto.Frequency,
                DayOfMonth = createDto.DayOfMonth,
                StartDate = createDto.StartDate,
                EndDate = createDto.EndDate,
                NumberOfOccurrences = createDto.NumberOfOccurrences,
                Description = createDto.Description,
                IsActive = true,
                NextGenerationDate = nextGenDate,
                RecurringItems = createDto.Items.Select(item => new RecurringInvoiceItem
                {
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    Rate = item.Rate,
                    GstPercentage = item.GstPercentage
                }).ToList()
            };

            var created = await _recurringInvoiceRepository.AddAsync(recurringInvoice);
            return _mapper.Map<RecurringInvoiceDto>(created);
        }

        public async Task<RecurringInvoiceDto> UpdateRecurringInvoiceAsync(int id, Guid userId, UpdateRecurringInvoiceDto updateDto)
        {
            var recurringInvoice = await _recurringInvoiceRepository.GetByIdAsync(id);
            if (recurringInvoice == null)
                throw new ArgumentException("Recurring invoice not found");

            if (recurringInvoice.UserId != userId)
                throw new UnauthorizedAccessException("You don't have permission to update this recurring invoice");

            // Validate customer belongs to user
            var customer = await _customerRepository.GetCustomerByIdAsync(updateDto.CustomerId, userId);
            if (customer == null || customer.UserId != userId)
                throw new ArgumentException("Customer not found");

            recurringInvoice.Name = updateDto.Name;
            recurringInvoice.CustomerId = updateDto.CustomerId;
            recurringInvoice.Frequency = updateDto.Frequency;
            recurringInvoice.DayOfMonth = updateDto.DayOfMonth;
            recurringInvoice.StartDate = updateDto.StartDate;
            recurringInvoice.EndDate = updateDto.EndDate;
            recurringInvoice.NumberOfOccurrences = updateDto.NumberOfOccurrences;
            recurringInvoice.IsActive = updateDto.IsActive;
            recurringInvoice.Description = updateDto.Description;
            recurringInvoice.UpdatedAt = DateTime.UtcNow;

            // Recalculate next generation date if active
            if (recurringInvoice.IsActive)
            {
                var baseDate = recurringInvoice.LastGeneratedDate ?? recurringInvoice.StartDate;
                recurringInvoice.NextGenerationDate = CalculateNextGenerationDate(baseDate, updateDto.Frequency, updateDto.DayOfMonth);
            }
            else
            {
                recurringInvoice.NextGenerationDate = null;
            }

            // Update items
            recurringInvoice.RecurringItems.Clear();
            foreach (var itemDto in updateDto.Items)
            {
                recurringInvoice.RecurringItems.Add(new RecurringInvoiceItem
                {
                    ProductName = itemDto.ProductName,
                    Quantity = itemDto.Quantity,
                    Rate = itemDto.Rate,
                    GstPercentage = itemDto.GstPercentage
                });
            }

            await _recurringInvoiceRepository.UpdateAsync(recurringInvoice);
            return _mapper.Map<RecurringInvoiceDto>(recurringInvoice);
        }

        public async Task<bool> DeleteRecurringInvoiceAsync(int id, Guid userId)
        {
            var recurringInvoice = await _recurringInvoiceRepository.GetByIdAsync(id);
            if (recurringInvoice == null)
                return false;

            if (recurringInvoice.UserId != userId)
                return false;

            return await _recurringInvoiceRepository.DeleteAsync(id);
        }

        public async Task<List<RecurringInvoiceDto>> GetUserRecurringInvoicesAsync(Guid userId)
        {
            var recurringInvoices = await _recurringInvoiceRepository.GetByUserIdAsync(userId);
            return _mapper.Map<List<RecurringInvoiceDto>>(recurringInvoices);
        }

        public async Task<RecurringInvoiceDto?> GetRecurringInvoiceByIdAsync(int id, Guid userId)
        {
            var recurringInvoice = await _recurringInvoiceRepository.GetByIdAsync(id);
            if (recurringInvoice == null)
                return null;

            if (recurringInvoice.UserId != userId)
                return null;

            return _mapper.Map<RecurringInvoiceDto>(recurringInvoice);
        }

        public async Task<List<InvoiceDto>> GenerateInvoicesFromRecurringAsync()
        {
            var activeRecurringInvoices = await _recurringInvoiceRepository.GetActiveRecurringInvoicesAsync();
            var generatedInvoices = new List<InvoiceDto>();

            foreach (var recurringInvoice in activeRecurringInvoices)
            {
                try
                {
                    var invoice = await GenerateInvoiceFromRecurring(recurringInvoice);
                    if (invoice != null)
                    {
                        generatedInvoices.Add(invoice);
                    }
                }
                catch (Exception ex)
                {
                    // Log error but continue with other recurring invoices
                    Console.Error.WriteLine($"Error generating invoice from recurring invoice {recurringInvoice.Id}: {ex.Message}");
                }
            }

            return generatedInvoices;
        }

        public async Task<InvoiceDto> GenerateInvoiceFromRecurringAsync(int recurringInvoiceId, Guid userId)
        {
            var recurringInvoice = await _recurringInvoiceRepository.GetByIdAsync(recurringInvoiceId);
            if (recurringInvoice == null)
                throw new ArgumentException("Recurring invoice not found");

            if (recurringInvoice.UserId != userId)
                throw new UnauthorizedAccessException("You don't have permission to generate invoice from this recurring invoice");

            if (!recurringInvoice.IsActive)
                throw new InvalidOperationException("Recurring invoice is not active");

            var invoice = await GenerateInvoiceFromRecurring(recurringInvoice);
            if (invoice == null)
                throw new InvalidOperationException("Failed to generate invoice");

            return invoice;
        }

        private async Task<InvoiceDto?> GenerateInvoiceFromRecurring(RecurringInvoice recurringInvoice)
        {
            var now = DateTime.UtcNow;

            // Check if it's time to generate
            if (recurringInvoice.NextGenerationDate.HasValue && recurringInvoice.NextGenerationDate.Value > now)
                return null; // Not time yet

            // Check end date
            if (recurringInvoice.EndDate.HasValue && recurringInvoice.EndDate.Value < now)
            {
                recurringInvoice.IsActive = false;
                await _recurringInvoiceRepository.UpdateAsync(recurringInvoice);
                return null;
            }

            // Check number of occurrences
            if (recurringInvoice.NumberOfOccurrences.HasValue && 
                recurringInvoice.GeneratedCount >= recurringInvoice.NumberOfOccurrences.Value)
            {
                recurringInvoice.IsActive = false;
                await _recurringInvoiceRepository.UpdateAsync(recurringInvoice);
                return null;
            }

            // Generate invoice
            var createInvoiceDto = new CreateInvoiceDto
            {
                CustomerId = recurringInvoice.CustomerId,
                DueDate = null, // Can be set based on business rules
                Items = recurringInvoice.RecurringItems.Select(item => new InvoiceItemDto
                {
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    Rate = item.Rate,
                    GstPercentage = item.GstPercentage
                }).ToList(),
                Status = "Sent", // Generated invoices start as "Sent"
                InitialPayment = 0
            };

            var invoice = await _invoiceService.CreateInvoiceAsync(recurringInvoice.UserId, createInvoiceDto);

            // Update recurring invoice
            recurringInvoice.GeneratedCount++;
            recurringInvoice.LastGeneratedDate = now;
            recurringInvoice.NextGenerationDate = CalculateNextGenerationDate(now, recurringInvoice.Frequency, recurringInvoice.DayOfMonth);
            recurringInvoice.UpdatedAt = now;

            // Check if should be deactivated
            if (recurringInvoice.EndDate.HasValue && recurringInvoice.NextGenerationDate > recurringInvoice.EndDate)
            {
                recurringInvoice.IsActive = false;
            }
            if (recurringInvoice.NumberOfOccurrences.HasValue && 
                recurringInvoice.GeneratedCount >= recurringInvoice.NumberOfOccurrences.Value)
            {
                recurringInvoice.IsActive = false;
            }

            await _recurringInvoiceRepository.UpdateAsync(recurringInvoice);

            return invoice;
        }

        private DateTime CalculateNextGenerationDate(DateTime baseDate, string frequency, int dayOfMonth)
        {
            return frequency.ToLower() switch
            {
                "daily" => baseDate.AddDays(1),
                "weekly" => baseDate.AddDays(7),
                "monthly" => CalculateMonthlyDate(baseDate, dayOfMonth),
                "yearly" => baseDate.AddYears(1),
                _ => CalculateMonthlyDate(baseDate, dayOfMonth) // Default to monthly
            };
        }

        private DateTime CalculateMonthlyDate(DateTime baseDate, int dayOfMonth)
        {
            var nextMonth = baseDate.AddMonths(1);
            // Ensure dayOfMonth is valid for the target month
            var daysInMonth = DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month);
            var targetDay = Math.Min(dayOfMonth, daysInMonth);
            return new DateTime(nextMonth.Year, nextMonth.Month, targetDay);
        }
    }
}
