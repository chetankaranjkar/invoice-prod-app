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
    public class InvoiceLayoutController : ControllerBase
    {
        private readonly IInvoiceLayoutService _layoutService;
        private readonly IInvoiceLayoutSchemaProvider _schemaProvider;
        private readonly IUserContext _userContext;
        private readonly IAuditService _auditService;

        public InvoiceLayoutController(
            IInvoiceLayoutService layoutService,
            IInvoiceLayoutSchemaProvider schemaProvider,
            IUserContext userContext,
            IAuditService auditService)
        {
            _layoutService = layoutService;
            _schemaProvider = schemaProvider;
            _userContext = userContext;
            _auditService = auditService;
        }

        [HttpGet]
        public async Task<ActionResult<List<InvoiceLayoutConfigDto>>> GetLayouts()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var layouts = await _layoutService.GetUserLayoutsAsync(userId.Value);
            return Ok(layouts);
        }

        [HttpGet("default")]
        public async Task<ActionResult<InvoiceLayoutConfigDto>> GetDefault()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var layout = await _layoutService.GetDefaultLayoutAsync(userId.Value);
            if (layout == null)
                return NotFound();

            return Ok(layout);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InvoiceLayoutConfigDto>> GetLayout(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var layout = await _layoutService.GetLayoutByIdAsync(id, userId.Value);
            if (layout == null)
                return NotFound();

            return Ok(layout);
        }

        [HttpGet("schema")]
        [AllowAnonymous]
        public ActionResult GetSchema()
        {
            return Ok(new { schema = _schemaProvider.GetSchemaJson() });
        }

        [HttpPost]
        public async Task<ActionResult<InvoiceLayoutConfigDto>> CreateLayout(CreateInvoiceLayoutConfigDto createDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            if (userRole == "MasterUser")
                return Forbid("MasterUser cannot create invoice layouts.");

            try
            {
                var layout = await _layoutService.CreateLayoutAsync(userId.Value, createDto);

                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "CREATE",
                    "InvoiceLayout",
                    layout.Id.ToString(),
                    layout.Name,
                    null,
                    new { layout.Name, layout.IsDefault },
                    $"Created invoice layout '{layout.Name}'",
                    null,
                    HttpContext);

                return CreatedAtAction(nameof(GetLayout), new { id = layout.Id }, layout);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<InvoiceLayoutConfigDto>> UpdateLayout(int id, UpdateInvoiceLayoutConfigDto updateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            if (userRole == "MasterUser")
                return Forbid("MasterUser cannot update invoice layouts.");

            try
            {
                var layout = await _layoutService.UpdateLayoutAsync(id, userId.Value, updateDto);

                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "UPDATE",
                    "InvoiceLayout",
                    layout.Id.ToString(),
                    layout.Name,
                    null,
                    new { layout.Name, layout.IsDefault },
                    $"Updated invoice layout '{layout.Name}'",
                    null,
                    HttpContext);

                return Ok(layout);
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPost("{id}/default")]
        public async Task<ActionResult<InvoiceLayoutConfigDto>> SetDefault(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            if (userRole == "MasterUser")
                return Forbid("MasterUser cannot update invoice layouts.");

            try
            {
                var layout = await _layoutService.SetDefaultAsync(id, userId.Value);
                return Ok(layout);
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteLayout(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            if (userRole == "MasterUser")
                return Forbid("MasterUser cannot delete invoice layouts.");

            var deleted = await _layoutService.DeleteLayoutAsync(id, userId.Value);
            if (!deleted)
                return NotFound();

            return Ok(new { message = "Layout deleted successfully" });
        }
    }
}
