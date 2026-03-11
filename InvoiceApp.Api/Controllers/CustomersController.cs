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
        private readonly IUserManagementService _userManagementService;

        public CustomersController(ICustomerRepository customerService, IUserContext userContext, IUserManagementService userManagementService)
        {
            _customerService = customerService;
            _userContext = userContext;
            _userManagementService = userManagementService;
        }

        [HttpGet]
        public async Task<ActionResult<List<CustomerProfileDto>>> GetCustomers([FromQuery] Guid? userId = null)
        {
            var currentUserId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (currentUserId == null) return Unauthorized();

            List<CustomerProfileDto> customers;
            if (userRole == "Admin" && userId.HasValue)
            {
                var createdUserIds = await _userManagementService.GetUserIdsCreatedByAdminAsync(currentUserId.Value);
                if (!createdUserIds.Contains(userId.Value) && userId.Value != currentUserId.Value)
                    return Forbid("You can only view customers of users you created or yourself.");
                customers = await _customerService.GetCustomersByUserIdAsync(userId.Value);
            }
            else if (userRole == "Admin")
            {
                customers = await _customerService.GetCustomersForAdminAsync(currentUserId.Value);
            }
            else
            {
                customers = await _customerService.GetCustomersByUserIdAsync(currentUserId.Value);
            }

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

            // Only Admin can share with users; validate SharedWithUserIds are users they created
            if (createDto.SharedWithUserIds != null && createDto.SharedWithUserIds.Count > 0)
            {
                if (userRole != "Admin")
                    return BadRequest(new { message = "Only Admin can share customers with other users." });
                var createdUserIds = await _userManagementService.GetUserIdsCreatedByAdminAsync(userId.Value);
                var invalid = createDto.SharedWithUserIds.Where(uid => !createdUserIds.Contains(uid) && uid != userId.Value).ToList();
                if (invalid.Count > 0)
                    return BadRequest(new { message = "You can only share with users you created." });
            }

            try
            {
                var customer = await _customerService.CreateCustomerAsync(userId.Value, createDto);
                return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id}/share")]
        public async Task<IActionResult> ShareCustomer(int id, [FromBody] ShareCustomerDto dto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || userRole != "Admin")
                return Forbid("Only Admin can share customers with other users.");

            var createdUserIds = await _userManagementService.GetUserIdsCreatedByAdminAsync(userId.Value);
            var invalid = (dto?.UserIds ?? new List<Guid>()).Where(uid => !createdUserIds.Contains(uid) && uid != userId.Value).ToList();
            if (invalid.Count > 0)
                return BadRequest(new { message = "You can only share with users you created." });

            try
            {
                await _customerService.ShareCustomerWithUsersAsync(id, userId.Value, dto?.UserIds ?? new List<Guid>());
                return NoContent();
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<CustomerProfileDto>> UpdateCustomer(int id, UpdateCustomerDto updateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole)) return Unauthorized();

            try
            {
                var customer = await _customerService.UpdateCustomerAsync(id, userId.Value, userRole, updateDto);
                if (customer == null) return NotFound(new { message = "Customer not found or you do not have permission to update it." });

                return Ok(customer);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null) return Unauthorized();

            try
            {
                var result = await _customerService.DeleteCustomerAsync(id, userId.Value);
                if (!result) return NotFound(new { message = "Customer not found or you do not have permission to delete it." });

                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
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