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
    public class InvoiceTemplateController : ControllerBase
    {
        private readonly IInvoiceTemplateService _templateService;
        private readonly IUserContext _userContext;
        private readonly IAuditService _auditService;

        public InvoiceTemplateController(
            IInvoiceTemplateService templateService,
            IUserContext userContext,
            IAuditService auditService)
        {
            _templateService = templateService;
            _userContext = userContext;
            _auditService = auditService;
        }

        [HttpGet]
        public async Task<ActionResult<List<InvoiceTemplateDto>>> GetTemplates()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var templates = await _templateService.GetUserTemplatesAsync(userId.Value);
            return Ok(templates);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InvoiceTemplateDto>> GetTemplate(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var template = await _templateService.GetTemplateByIdAsync(id, userId.Value);
            if (template == null)
                return NotFound();

            return Ok(template);
        }

        [HttpPost]
        public async Task<ActionResult<InvoiceTemplateDto>> CreateTemplate(CreateInvoiceTemplateDto createTemplateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot create templates
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot create invoice templates.");
            }

            try
            {
                var template = await _templateService.CreateTemplateAsync(userId.Value, createTemplateDto);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "CREATE",
                    "InvoiceTemplate",
                    template.Id.ToString(),
                    template.TemplateName,
                    null,
                    new { template.TemplateName, template.Description, ItemCount = template.Items.Count },
                    $"Created invoice template '{template.TemplateName}' with {template.Items.Count} items",
                    null,
                    HttpContext);

                return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, template);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<InvoiceTemplateDto>> UpdateTemplate(int id, UpdateInvoiceTemplateDto updateTemplateDto)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot update templates
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot update invoice templates.");
            }

            try
            {
                var originalTemplate = await _templateService.GetTemplateByIdAsync(id, userId.Value);
                var template = await _templateService.UpdateTemplateAsync(id, userId.Value, updateTemplateDto);

                // Audit log
                await _auditService.LogActionAsync(
                    userId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "UPDATE",
                    "InvoiceTemplate",
                    template.Id.ToString(),
                    template.TemplateName,
                    originalTemplate != null ? new { originalTemplate.TemplateName, originalTemplate.Description, ItemCount = originalTemplate.Items.Count } : null,
                    new { template.TemplateName, template.Description, ItemCount = template.Items.Count },
                    $"Updated invoice template '{template.TemplateName}'",
                    null,
                    HttpContext);

                return Ok(template);
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

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteTemplate(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (userId == null || string.IsNullOrEmpty(userRole))
                return Unauthorized("User not authenticated");

            // MasterUser cannot delete templates
            if (userRole == "MasterUser")
            {
                return Forbid("MasterUser cannot delete invoice templates.");
            }

            var template = await _templateService.GetTemplateByIdAsync(id, userId.Value);
            var deleted = await _templateService.DeleteTemplateAsync(id, userId.Value);

            if (!deleted)
                return NotFound();

            // Audit log
            await _auditService.LogActionAsync(
                userId.Value,
                _userContext.GetCurrentUserName(),
                _userContext.GetCurrentUserEmail(),
                "DELETE",
                "InvoiceTemplate",
                id.ToString(),
                template?.TemplateName ?? id.ToString(),
                template != null ? new { template.TemplateName, template.Description, ItemCount = template.Items.Count } : null,
                null,
                $"Deleted invoice template '{template?.TemplateName ?? id.ToString()}'",
                null,
                HttpContext);

            return Ok(new { message = "Template deleted successfully" });
        }
    }
}
