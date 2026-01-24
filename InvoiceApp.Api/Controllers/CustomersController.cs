using AutoMapper;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Api.Controllers
{

    [Authorize]
    public class CustomersController : BaseController
    {
        private readonly ICustomerRepository _customerService;
        private readonly IUserContext _userContext;

        public CustomersController(ICustomerRepository customerService, IUserContext userContext)
        {
            _customerService = customerService;
            _userContext = userContext;
        }

        [HttpGet]
        public async Task<ActionResult<List<CustomerProfileDto>>> GetCustomers()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var customers = await _customerService.GetCustomersByUserIdAsync(userId.Value);
            return Ok(customers);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CustomerProfileDto>> GetCustomer(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole)) return Unauthorized();

            // Try to get customer - for Admin/MasterUser, also check if customer is used in accessible invoices
            var customer = await _customerService.GetCustomerByIdAsync(id, userId.Value, userRole);
            if (customer == null) return NotFound();

            return Ok(customer);
        }

        [HttpPost]
        public async Task<ActionResult<CustomerProfileDto>> CreateCustomer(CreateCustomerDto createDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized();

            // MasterUser cannot create customers - they can only manage admins
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot create customers. Only Admin and User roles can create customers.");
            }

            var customer = await _customerService.CreateCustomerAsync(userId.Value, createDto);
            return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<CustomerProfileDto>> UpdateCustomer(int id, UpdateCustomerDto updateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var customer = await _customerService.UpdateCustomerAsync(id, userId.Value, updateDto);
            if (customer == null) return NotFound();

            return Ok(customer);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null) return Unauthorized();

            try
            {
                var result = await _customerService.DeleteCustomerAsync(id, userId.Value);
                if (!result) return NotFound();

                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("search")]
        public async Task<ActionResult<List<CustomerProfileDto>>> SearchCustomers([FromQuery] string term)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var customers = await _customerService.SearchCustomersAsync(userId.Value, term);
            return Ok(customers);
        }
    }
}