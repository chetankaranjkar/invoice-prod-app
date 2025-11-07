using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using System.Linq;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<UserController> _logger;

        public UserController(IUserService userService, ILogger<UserController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        [HttpGet("profile")]
        public async Task<ActionResult<UserProfileDto>> GetProfile()
        {
            try
            {
                _logger.LogInformation("GetProfile called");

                var userId = GetCurrentUserId();
                _logger.LogInformation($"Extracted UserId: {userId}");

                if (userId == null)
                {
                    _logger.LogWarning("User ID not found in token");
                    return Unauthorized("User ID not found in token");
                }

                var profile = await _userService.GetUserProfileAsync(userId.Value);
                if (profile == null)
                {
                    _logger.LogWarning($"User profile not found for ID: {userId}");
                    return NotFound("User profile not found");
                }

                _logger.LogInformation($"Profile found for user: {profile.Email}");
                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetProfile");
                return StatusCode(500, "An error occurred while retrieving profile");
            }
        }

        [HttpPut("profile")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfile(UpdateUserProfileDto updateDto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null) return Unauthorized("User ID not found in token");

                var profile = await _userService.UpdateUserProfileAsync(userId.Value, updateDto);
                if (profile == null) return NotFound("User profile not found");

                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateProfile");
                return StatusCode(500, "An error occurred while updating profile");
            }
        }

        [HttpPost("upload-logo")]
        public async Task<ActionResult<string>> UploadLogo(IFormFile logo)
        {
            try
            {
                // Debug: Check if we have a user
                var userId = GetCurrentUserId();
                Console.WriteLine($"UploadLogo - UserId: {userId}");

                if (userId == null)
                {
                    Console.WriteLine("UploadLogo - No user ID found in token");
                    return Unauthorized("User ID not found in token");
                }

                if (logo == null || logo.Length == 0)
                    return BadRequest("No logo file provided");

                var logoUrl = await _userService.UploadLogoAsync(userId.Value, logo);
                if (logoUrl == null) return BadRequest("Failed to upload logo");

                return Ok(new { logoUrl });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UploadLogo");
                return StatusCode(500, "An error occurred while uploading the logo");
            }
        }

        [HttpPost("profile-with-logo")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfileWithLogo([FromForm] UpdateUserProfileDto updateDto, IFormFile? logo)
        {
            try
            {
                var userId = GetCurrentUserId();
                Console.WriteLine($"UpdateProfileWithLogo - UserId: {userId}");

                if (userId == null)
                {
                    Console.WriteLine("UpdateProfileWithLogo - No user ID found in token");
                    return Unauthorized("User ID not found in token");
                }

                // Update profile
                UserProfileDto? profile = null;
                if (updateDto != null)
                {
                    profile = await _userService.UpdateUserProfileAsync(userId.Value, updateDto);
                }

                // Upload logo if provided
                if (logo != null)
                {
                    var logoUrl = await _userService.UploadLogoAsync(userId.Value, logo);
                    if (logoUrl != null)
                    {
                        // If we didn't update profile, get current profile
                        profile ??= await _userService.GetUserProfileAsync(userId.Value);
                    }
                }

                if (profile == null) return NotFound("User profile not found");

                return Ok(profile);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateProfileWithLogo");
                return StatusCode(500, "An error occurred while updating profile");
            }
        }

        private Guid? GetCurrentUserId()
        {
            try
            {
                // Try multiple possible claim types
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                _logger.LogInformation($"Available claims: {string.Join(", ", User.Claims.Select(c => $"{c.Type}: {c.Value}"))}");

                if (string.IsNullOrEmpty(userIdClaim))
                {
                    _logger.LogWarning("No user ID claim found");
                    return null;
                }

                if (Guid.TryParse(userIdClaim, out var userId))
                {
                    _logger.LogInformation($"Successfully parsed UserId: {userId}");
                    return userId;
                }

                _logger.LogWarning($"Failed to parse UserId from claim: {userIdClaim}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetCurrentUserId");
                return null;
            }
        }
    }
}