using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BaseController : ControllerBase
    {
        /// <summary>
        /// Return 403 with a JSON message. Do not use Forbid(string) — that treats the string as an auth scheme name.
        /// </summary>
        protected ActionResult Forbidden(string message) =>
            new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };
    }
}
