using Microsoft.AspNetCore.Mvc;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.DTOs;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class ProductController : ControllerBase
    {
        private readonly IProductService _productService;
        private readonly IUserContext _userContext;

        public ProductController(IProductService productService, IUserContext userContext)
        {
            _productService = productService;
            _userContext = userContext;
        }

        [HttpGet("search")]
        public async Task<ActionResult<List<ProductDto>>> Search([FromQuery] string? q, [FromQuery] int limit = 20)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var products = await _productService.SearchProductsAsync(userId.Value, q, limit);
            return Ok(products);
        }

        [HttpGet]
        public async Task<ActionResult<List<ProductDto>>> GetAll()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var products = await _productService.GetAllProductsAsync(userId.Value);
            return Ok(products);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<ProductDto>> GetById(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var product = await _productService.GetProductByIdAsync(id, userId.Value);
            if (product == null)
                return NotFound();
            return Ok(product);
        }

        [HttpPost]
        public async Task<ActionResult<ProductDto>> Create([FromBody] CreateProductDto dto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            try
            {
                var product = await _productService.CreateProductAsync(userId.Value, dto);
                return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<ProductDto>> Update(int id, [FromBody] UpdateProductDto dto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            try
            {
                var product = await _productService.UpdateProductAsync(id, userId.Value, dto);
                if (product == null)
                    return NotFound();
                return Ok(product);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<ActionResult> Delete(int id)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var deleted = await _productService.DeleteProductAsync(id, userId.Value);
            if (!deleted)
                return NotFound();
            return NoContent();
        }
    }
}
