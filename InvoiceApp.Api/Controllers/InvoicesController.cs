using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class InvoicesController : ControllerBase
    {
        private readonly IInvoiceService _invoiceService;
        private readonly IUserContext _userContext;

        public InvoicesController(
            IInvoiceService invoiceService,
            IUserContext userContext)
        {
            _invoiceService = invoiceService;
            _userContext = userContext;
        }

        [HttpGet]
        public async Task<ActionResult<List<InvoiceDto>>> GetInvoices()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var invoices = await _invoiceService.GetUserInvoicesAsync(userId.Value);
            return Ok(invoices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InvoiceDto>> GetInvoice(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var invoice = await _invoiceService.GetInvoiceByIdAsync(id, userId.Value);

            if (invoice == null)
                return NotFound();

            return Ok(invoice);
        }

        [HttpPost]
        public async Task<ActionResult<InvoiceDto>> CreateInvoice(CreateInvoiceDto createInvoiceDto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var invoice = await _invoiceService.CreateInvoiceAsync(userId.Value, createInvoiceDto);
            return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, invoice);
        }

        [HttpPost("{id}/payments")]
        public async Task<ActionResult> AddPayment(int id, PaymentDto paymentDto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var result = await _invoiceService.AddPaymentAsync(id, userId.Value, paymentDto);

            if (!result)
                return NotFound();

            return Ok(new { message = "Payment added successfully" });
        }
    }
}