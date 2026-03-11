using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class InvoicesController : ControllerBase
    {
        private readonly IInvoiceService _invoiceService;
        private readonly IUserContext _userContext;
        private readonly IAuditService _auditService;

        public InvoicesController(
            IInvoiceService invoiceService,
            IUserContext userContext,
            IAuditService auditService)
        {
            _invoiceService = invoiceService;
            _userContext = userContext;
            _auditService = auditService;
        }

        [HttpGet]
        public async Task<ActionResult<List<InvoiceDto>>> GetInvoices()
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            List<InvoiceDto> invoices;
            if (userRole == "MasterUser")
            {
                // MasterUser sees all invoices from all users
                invoices = await _invoiceService.GetAllInvoicesAsync();
            }
            else if (userRole == "Admin")
            {
                // Admin sees invoices from all users they created
                invoices = await _invoiceService.GetAdminInvoicesAsync(userId.Value);
            }
            else
            {
                // Regular user sees only their own invoices
                invoices = await _invoiceService.GetUserInvoicesAsync(userId.Value);
            }
            
            return Ok(invoices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InvoiceDto>> GetInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            var invoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value, userRole);

            if (invoice == null)
                return NotFound(new { message = "Invoice not found" });

            return Ok(invoice);
        }

        [HttpPost]
        public async Task<ActionResult<InvoiceDto>> CreateInvoice(CreateInvoiceDto createInvoiceDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot create invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot create invoices. Only Admin and User roles can create invoices.");
            }

            var invoice = await _invoiceService.CreateInvoiceAsync(userId.Value, createInvoiceDto, userRole);
            
            // Audit log
            await _auditService.LogActionAsync(
                userId.Value,
                _userContext.GetCurrentUserName(),
                _userContext.GetCurrentUserEmail(),
                "CREATE",
                "Invoice",
                invoice.Id.ToString(),
                invoice.InvoiceNumber,
                null,
                new { invoice.InvoiceNumber, invoice.CustomerName, invoice.GrandTotal, invoice.Status },
                $"Created invoice {invoice.InvoiceNumber} for customer {invoice.CustomerName}",
                null,
                HttpContext);

            return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, invoice);
        }

        [HttpPost("{id}/payments")]
        public async Task<ActionResult> AddPayment(int id, PaymentDto paymentDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // Get invoice details for audit
            var invoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value, userRole);
            
            var result = await _invoiceService.AddPaymentAsync(id, userId.Value, paymentDto, userRole);

            if (!result)
                return NotFound(new { message = "Invoice not found" });

            // Audit log
            await _auditService.LogActionAsync(
                userId.Value,
                _userContext.GetCurrentUserName(),
                _userContext.GetCurrentUserEmail(),
                "ADD_PAYMENT",
                "Payment",
                id.ToString(),
                invoice?.InvoiceNumber ?? id.ToString(),
                null,
                new { InvoiceId = id, paymentDto.AmountPaid, paymentDto.WaveAmount, paymentDto.PaymentMode, paymentDto.Remarks },
                $"Added payment of ₹{paymentDto.AmountPaid} to invoice {invoice?.InvoiceNumber ?? id.ToString()}" + 
                (paymentDto.WaveAmount > 0 ? $" with wave off of ₹{paymentDto.WaveAmount}" : ""),
                null,
                HttpContext);

            return Ok(new { message = "Payment added successfully" });
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<InvoiceDto>> UpdateInvoice(int id, UpdateInvoiceDto updateInvoiceDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot update invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot update invoices.");
            }

            try
            {
                // Get original invoice for audit
                var originalInvoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value, userRole);
                
                var invoice = await _invoiceService.UpdateInvoiceAsync(id, userId.Value, updateInvoiceDto, userRole);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "UPDATE",
                    "Invoice",
                    invoice.Id.ToString(),
                    invoice.InvoiceNumber,
                    originalInvoice != null ? new { originalInvoice.CustomerId, originalInvoice.GrandTotal, originalInvoice.Status } : null,
                    new { invoice.CustomerId, invoice.GrandTotal, invoice.Status },
                    $"Updated invoice {invoice.InvoiceNumber}",
                    null,
                    HttpContext);

                return Ok(invoice);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // Get invoice details for audit before deletion
            var invoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value, userRole);
            
            var deleted = await _invoiceService.DeleteInvoiceAsync(id, userId.Value, userRole);

            if (!deleted)
                return NotFound(new { message = "Invoice not found" });

            // Audit log
            await _auditService.LogActionAsync(
                userId.Value,
                _userContext.GetCurrentUserName(),
                _userContext.GetCurrentUserEmail(),
                "DELETE",
                "Invoice",
                id.ToString(),
                invoice?.InvoiceNumber ?? id.ToString(),
                invoice != null ? new { invoice.CustomerName, invoice.GrandTotal, invoice.Status } : null,
                null,
                $"Deleted invoice {invoice?.InvoiceNumber ?? id.ToString()}",
                null,
                HttpContext);

            return Ok(new { message = "Invoice deleted successfully" });
        }

        [HttpPost("{id}/duplicate")]
        public async Task<ActionResult<InvoiceDto>> DuplicateInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot duplicate invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot duplicate invoices.");
            }

            try
            {
                var originalInvoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value, userRole);
                var invoice = await _invoiceService.DuplicateInvoiceAsync(id, userId.Value, userRole);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "DUPLICATE",
                    "Invoice",
                    invoice.Id.ToString(),
                    invoice.InvoiceNumber,
                    originalInvoice != null ? new { OriginalInvoiceId = originalInvoice.Id, OriginalInvoiceNumber = originalInvoice.InvoiceNumber } : null,
                    new { invoice.InvoiceNumber, invoice.CustomerName, invoice.GrandTotal },
                    $"Duplicated invoice {originalInvoice?.InvoiceNumber ?? id.ToString()} to {invoice.InvoiceNumber}",
                    null,
                    HttpContext);

                return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, invoice);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
        }
    }
}