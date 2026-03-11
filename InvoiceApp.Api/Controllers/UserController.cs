using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Infrastructure.Services;
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
        private readonly IUserContext _userContext;
        private readonly IUserManagementService _userManagementService;
        private readonly ILogger<UserController> _logger;

        public UserController(IUserService userService, IUserContext userContext, IUserManagementService userManagementService, ILogger<UserController> logger)
        {
            _userService = userService;
            _userContext = userContext;
            _userManagementService = userManagementService;
            _logger = logger;
        }

        [HttpGet("profile")]
        public async Task<ActionResult<UserProfileDto>> GetProfile()
        {
            var currentUserId = _userContext.GetCurrentUserId();
            if (currentUserId == null) return Unauthorized("User ID not found in token");

            var profile = await _userService.GetUserProfileAsync(currentUserId.Value);
            if (profile == null) return NotFound(new { message = "User profile not found" });
            return Ok(profile);
        }

        [HttpGet("profile/{userId:guid}")]
        public async Task<ActionResult<UserProfileDto>> GetProfileById(Guid userId)
        {
            var currentUserId = _userContext.GetCurrentUserId();
            var userRole = _userContext.GetCurrentUserRole();
            if (currentUserId == null) return Unauthorized("User ID not found in token");

            if (userId != currentUserId.Value)
            {
                if (userRole == "MasterUser") { /* MasterUser can get any profile */ }
                else if (userRole == "Admin")
                {
                    var createdIds = await _userManagementService.GetUserIdsCreatedByAdminAsync(currentUserId.Value);
                    if (!createdIds.Contains(userId))
                        return Forbid("You can only view profiles of users you created.");
                }
                else
                    return Forbid("You can only view your own profile.");
            }

            var profile = await _userService.GetUserProfileAsync(userId);
            if (profile == null) return NotFound(new { message = "User profile not found" });
            return Ok(profile);
        }

        [HttpPut("profile")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfile(UpdateUserProfileDto updateDto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null) return Unauthorized("User ID not found in token");

                var profile = await _userService.UpdateUserProfileAsync(userId.Value, updateDto);
                if (profile == null) return NotFound(new { message = "User profile not found" });

                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateProfile");
                return StatusCode(500, new { message = "An error occurred while updating profile" });
            }
        }

        [HttpPost("upload-logo")]
        public async Task<ActionResult<string>> UploadLogo(IFormFile logo)
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("UploadLogo called for user: {UserId}", userId);

                if (userId == null)
                {
                    _logger.LogWarning("UploadLogo - No user ID found in token");
                    return Unauthorized("User ID not found in token");
                }

                if (logo == null || logo.Length == 0)
                    return BadRequest(new { message = "No logo file provided" });

                var logoUrl = await _userService.UploadLogoAsync(userId.Value, logo);
                if (logoUrl == null) return BadRequest(new { message = "Failed to upload logo" });

                return Ok(new { logoUrl });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UploadLogo");
                return StatusCode(500, new { message = "An error occurred while uploading the logo" });
            }
        }

        [HttpPost("profile-with-logo")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfileWithLogo([FromForm] UpdateUserProfileDto updateDto, IFormFile? logo)
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("UpdateProfileWithLogo called for user: {UserId}", userId);

                if (userId == null)
                {
                    _logger.LogWarning("UpdateProfileWithLogo - No user ID found in token");
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

                if (profile == null) return NotFound(new { message = "User profile not found" });

                return Ok(profile);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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