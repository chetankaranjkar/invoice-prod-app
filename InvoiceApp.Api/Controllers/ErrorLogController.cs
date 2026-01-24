using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using System.Collections.Generic;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "MasterUser")]
    public class ErrorLogController : ControllerBase
    {
        private readonly IErrorLogService _errorLogService;
        private readonly IUserContext _userContext;
        private readonly ILogger<ErrorLogController> _logger;

        public ErrorLogController(
            IErrorLogService errorLogService,
            IUserContext userContext,
            ILogger<ErrorLogController> logger)
        {
            _errorLogService = errorLogService;
            _userContext = userContext;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<ErrorLog>>> GetAllErrors([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            try
            {
                var errors = await _errorLogService.GetAllErrorsAsync(page, pageSize);
                return Ok(errors);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting error logs");
                return StatusCode(500, new { error = "An error occurred while retrieving error logs" });
            }
        }

        [HttpGet("unresolved")]
        public async Task<ActionResult<List<ErrorLog>>> GetUnresolvedErrors()
        {
            try
            {
                var errors = await _errorLogService.GetUnresolvedErrorsAsync();
                return Ok(errors);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unresolved error logs");
                return StatusCode(500, new { error = "An error occurred while retrieving unresolved error logs" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ErrorLog>> GetErrorById(int id)
        {
            try
            {
                var error = await _errorLogService.GetErrorByIdAsync(id);
                if (error == null)
                    return NotFound();

                return Ok(error);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting error log by ID");
                return StatusCode(500, new { error = "An error occurred while retrieving error log" });
            }
        }

        [HttpGet("stats")]
        public async Task<ActionResult<ErrorLogStats>> GetErrorStats()
        {
            try
            {
                var stats = await _errorLogService.GetErrorStatsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting error stats");
                return StatusCode(500, new { error = "An error occurred while retrieving error stats" });
            }
        }

        [HttpPost("{id}/resolve")]
        public async Task<ActionResult> MarkAsResolved(int id, [FromBody] ResolveErrorRequest request)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserEmail = _userContext.GetCurrentUserEmail();
                var resolvedBy = $"{currentUserEmail} ({currentUserId})";

                var result = await _errorLogService.MarkErrorAsResolvedAsync(id, resolvedBy, request.ResolutionNotes);
                if (!result)
                    return NotFound();

                return Ok(new { message = "Error marked as resolved" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking error as resolved");
                return StatusCode(500, new { error = "An error occurred while marking error as resolved" });
            }
        }
    }

    public class ResolveErrorRequest
    {
        public string? ResolutionNotes { get; set; }
    }
}
