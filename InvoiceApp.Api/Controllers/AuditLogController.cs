using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/AuditLog")]
    [Authorize(Roles = "Admin")]
    public class AuditLogController : ControllerBase
    {
        private readonly IAuditLogRepository _auditLogRepository;

        public AuditLogController(IAuditLogRepository auditLogRepository)
        {
            _auditLogRepository = auditLogRepository;
        }

        [HttpGet]
        public async Task<ActionResult> GetAuditLogs([FromQuery] AuditLogFilterDto filter)
        {
            try
            {
                // Ensure filter has default values
                if (filter.PageNumber < 1) filter.PageNumber = 1;
                if (filter.PageSize < 1) filter.PageSize = 50;

                var auditLogs = await _auditLogRepository.GetAuditLogsAsync(filter);
                var totalCount = await _auditLogRepository.GetAuditLogsCountAsync(filter);

                return Ok(new
                {
                    data = auditLogs,
                    totalCount = totalCount,
                    pageNumber = filter.PageNumber,
                    pageSize = filter.PageSize,
                    totalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving audit logs", error = ex.Message });
            }
        }
    }
}

