using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using InvoiceApp.Infrastructure.Services;

namespace InvoiceApp.Api.Controllers
{
    

    public class HealthController : BaseController
    {
        private readonly DatabaseHealthService _healthService;

        public HealthController(DatabaseHealthService healthService)
        {
            _healthService = healthService;
        }

        [HttpGet]
        public async Task<ActionResult> GetHealth()
        {
            var status = await _healthService.GetDatabaseStatusAsync();
            return Ok(new
            {
                Status = "Healthy",
                Database = status,
                Timestamp = DateTime.UtcNow
            });
        }

        [HttpGet("database")]
        public async Task<ActionResult> GetDatabaseHealth()
        {
            var isConnected = await _healthService.IsDatabaseConnectedAsync();
            var isCreated = await _healthService.IsDatabaseCreatedAsync();

            return Ok(new
            {
                IsConnected = isConnected,
                IsCreated = isCreated,
                Status = isConnected ? (isCreated ? "Ready" : "Needs Creation") : "Disconnected"
            });
        }
    }
}