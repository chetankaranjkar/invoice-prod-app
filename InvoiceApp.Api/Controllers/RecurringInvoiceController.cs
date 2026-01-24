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
    public class RecurringInvoiceController : ControllerBase
    {
        private readonly IRecurringInvoiceService _recurringInvoiceService;
        private readonly IUserContext _userContext;
        private readonly IAuditService _auditService;

        public RecurringInvoiceController(
            IRecurringInvoiceService recurringInvoiceService,
            IUserContext userContext,
            IAuditService auditService)
        {
            _recurringInvoiceService = recurringInvoiceService;
            _userContext = userContext;
            _auditService = auditService;
        }

        [HttpGet]
        public async Task<ActionResult<List<RecurringInvoiceDto>>> GetRecurringInvoices()
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            var recurringInvoices = await _recurringInvoiceService.GetUserRecurringInvoicesAsync(userId.Value);
            return Ok(recurringInvoices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<RecurringInvoiceDto>> GetRecurringInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var recurringInvoice = await _recurringInvoiceService.GetRecurringInvoiceByIdAsync(id, userId.Value);
            if (recurringInvoice == null)
                return NotFound();

            return Ok(recurringInvoice);
        }

        [HttpPost]
        public async Task<ActionResult<RecurringInvoiceDto>> CreateRecurringInvoice(CreateRecurringInvoiceDto createDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot create recurring invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot create recurring invoices.");
            }

            try
            {
                var recurringInvoice = await _recurringInvoiceService.CreateRecurringInvoiceAsync(userId.Value, createDto);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "CREATE",
                    "RecurringInvoice",
                    recurringInvoice.Id.ToString(),
                    recurringInvoice.Name,
                    null,
                    new { recurringInvoice.Name, recurringInvoice.Frequency, recurringInvoice.CustomerName, ItemCount = recurringInvoice.Items.Count },
                    $"Created recurring invoice '{recurringInvoice.Name}' ({recurringInvoice.Frequency})",
                    null,
                    HttpContext);

                return CreatedAtAction(nameof(GetRecurringInvoice), new { id = recurringInvoice.Id }, recurringInvoice);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<RecurringInvoiceDto>> UpdateRecurringInvoice(int id, UpdateRecurringInvoiceDto updateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot update recurring invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot update recurring invoices.");
            }

            try
            {
                var original = await _recurringInvoiceService.GetRecurringInvoiceByIdAsync(id, userId.Value);
                var recurringInvoice = await _recurringInvoiceService.UpdateRecurringInvoiceAsync(id, userId.Value, updateDto);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "UPDATE",
                    "RecurringInvoice",
                    recurringInvoice.Id.ToString(),
                    recurringInvoice.Name,
                    original != null ? new { original.Name, original.Frequency, original.IsActive } : null,
                    new { recurringInvoice.Name, recurringInvoice.Frequency, recurringInvoice.IsActive },
                    $"Updated recurring invoice '{recurringInvoice.Name}'",
                    null,
                    HttpContext);

                return Ok(recurringInvoice);
            }
            catch (ArgumentException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteRecurringInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot delete recurring invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot delete recurring invoices.");
            }

            var recurringInvoice = await _recurringInvoiceService.GetRecurringInvoiceByIdAsync(id, userId.Value);
            var deleted = await _recurringInvoiceService.DeleteRecurringInvoiceAsync(id, userId.Value);

            if (!deleted)
                return NotFound();

            // Audit log
            await _auditService.LogActionAsync(
                userId.Value,
                _userContext.GetCurrentUserName(),
                _userContext.GetCurrentUserEmail(),
                "DELETE",
                "RecurringInvoice",
                id.ToString(),
                recurringInvoice?.Name ?? id.ToString(),
                recurringInvoice != null ? new { recurringInvoice.Name, recurringInvoice.Frequency } : null,
                null,
                $"Deleted recurring invoice '{recurringInvoice?.Name ?? id.ToString()}'",
                null,
                HttpContext);

            return Ok(new { message = "Recurring invoice deleted successfully" });
        }

        [HttpPost("{id}/generate")]
        public async Task<ActionResult<InvoiceDto>> GenerateInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot generate invoices
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot generate invoices from recurring invoices.");
            }

            try
            {
                var invoice = await _recurringInvoiceService.GenerateInvoiceFromRecurringAsync(id, userId.Value);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "GENERATE",
                    "Invoice",
                    invoice.Id.ToString(),
                    invoice.InvoiceNumber,
                    new { RecurringInvoiceId = id },
                    new { invoice.InvoiceNumber, invoice.CustomerName, invoice.GrandTotal },
                    $"Generated invoice {invoice.InvoiceNumber} from recurring invoice {id}",
                    null,
                    HttpContext);

                return Ok(invoice);
            }
            catch (ArgumentException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("generate-all")]
        [Authorize(Roles = "Admin,MasterUser")]
        public async Task<ActionResult<List<InvoiceDto>>> GenerateAllInvoices()
        {
            var invoices = await _recurringInvoiceService.GenerateInvoicesFromRecurringAsync();
            return Ok(new { message = $"Generated {invoices.Count} invoice(s)", invoices });
        }
    }
}
