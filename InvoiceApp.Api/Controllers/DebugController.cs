using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Linq;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DebugController : ControllerBase
    {
        [HttpGet("claims")]
        public IActionResult GetClaims()
        {
            var claims = User.Claims.Select(c => new { c.Type, c.Value }).ToList();
            return Ok(new
            {
                IsAuthenticated = User.Identity?.IsAuthenticated,
                UserName = User.Identity?.Name,
                Claims = claims
            });
        }

        [HttpGet("userid")]
        public IActionResult GetUserId()
        {
            var userIdClaim = User.FindFirst("userid")?.Value;
            var nameIdentifier = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var sub = User.FindFirst("sub")?.Value;

            return Ok(new
            {
                UserIdClaim = userIdClaim,
                NameIdentifier = nameIdentifier,
                SubClaim = sub,
                AllClaims = User.Claims.Select(c => $"{c.Type}: {c.Value}").ToList()
            });
        }
    }
}