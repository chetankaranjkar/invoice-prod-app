using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Application.Services;
using System.Security.Claims;
using System.Linq;

namespace InvoiceApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "MasterUser,Admin")]
    public class UserManagementController : ControllerBase
    {
        private readonly IUserManagementService _userManagementService;
        private readonly IUserContext _userContext;
        private readonly ILogger<UserManagementController> _logger;
        private readonly IAuditService _auditService;

        public UserManagementController(
            IUserManagementService userManagementService, 
            IUserContext userContext,
            ILogger<UserManagementController> logger,
            IAuditService auditService)
        {
            _userManagementService = userManagementService;
            _userContext = userContext;
            _logger = logger;
            _auditService = auditService;
        }

        [HttpGet("users")]
        public async Task<ActionResult> GetAllUsers()
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserRole = _userContext.GetCurrentUserRole();
                if (currentUserId == null || string.IsNullOrEmpty(currentUserRole))
                    return Unauthorized("User not authenticated");

                var users = await _userManagementService.GetAllUsersAsync(currentUserId.Value, currentUserRole);
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all users");
                return StatusCode(500, "An error occurred while retrieving users");
            }
        }

        [HttpPost("users")]
        public async Task<ActionResult<UserListDto>> CreateUser(CreateUserDto createUserDto)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserRole = _userContext.GetCurrentUserRole();
                if (currentUserId == null || string.IsNullOrEmpty(currentUserRole))
                    return Unauthorized("User not authenticated");

                var user = await _userManagementService.CreateUserAsync(createUserDto, currentUserId.Value, currentUserRole);
                if (user == null)
                    return BadRequest("Failed to create user");

                // Audit log
                await _auditService.LogActionAsync(
                    currentUserId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "CREATE",
                    "User",
                    user.Id.ToString(),
                    user.Name,
                    null,
                    new { user.Name, user.Email, user.Role, user.BusinessName },
                    $"Created new user: {user.Name} ({user.Email}) with role {user.Role}",
                    null,
                    HttpContext);

                return Ok(user);
            }
            catch (UnauthorizedAccessException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                // Handle duplicate email or other validation errors
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user");
                return StatusCode(500, "An error occurred while creating user");
            }
        }

        [HttpPut("users/{userId}")]
        public async Task<ActionResult<UserListDto>> UpdateUser(Guid userId, CreateUserDto updateUserDto)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserRole = _userContext.GetCurrentUserRole();
                if (currentUserId == null || string.IsNullOrEmpty(currentUserRole))
                    return Unauthorized("User not authenticated");

                // Get old user data for audit
                var oldUser = await _userManagementService.GetUserByIdAsync(userId, currentUserId.Value, currentUserRole);
                
                var user = await _userManagementService.UpdateUserAsync(userId, updateUserDto, currentUserId.Value, currentUserRole);
                if (user == null)
                    return NotFound("User not found or you don't have permission to update this user");

                // Audit log
                await _auditService.LogActionAsync(
                    currentUserId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "UPDATE",
                    "User",
                    user.Id.ToString(),
                    user.Name,
                    oldUser != null ? new { oldUser.Name, oldUser.Email, oldUser.Role, oldUser.BusinessName } : null,
                    new { user.Name, user.Email, user.Role, user.BusinessName },
                    $"Updated user: {user.Name} ({user.Email})",
                    null,
                    HttpContext);

                return Ok(user);
            }
            catch (InvalidOperationException ex)
            {
                // Handle duplicate email or other validation errors
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user");
                return StatusCode(500, "An error occurred while updating user");
            }
        }

        [HttpDelete("users/{userId}")]
        public async Task<ActionResult> DeleteUser(Guid userId)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserRole = _userContext.GetCurrentUserRole();
                if (currentUserId == null || string.IsNullOrEmpty(currentUserRole))
                    return Unauthorized("User not authenticated");

                // Get user data for audit before deletion
                var userToDelete = await _userManagementService.GetUserByIdAsync(userId, currentUserId.Value, currentUserRole);

                var result = await _userManagementService.DeleteUserAsync(userId, currentUserId.Value, currentUserRole);
                if (!result)
                    return NotFound("User not found or you don't have permission to delete this user");

                // Audit log
                await _auditService.LogActionAsync(
                    currentUserId.Value,
                    _userContext.GetCurrentUserName(),
                    _userContext.GetCurrentUserEmail(),
                    "DELETE",
                    "User",
                    userId.ToString(),
                    userToDelete?.Name ?? "Unknown",
                    userToDelete != null ? new { userToDelete.Name, userToDelete.Email, userToDelete.Role, userToDelete.BusinessName } : null,
                    null,
                    $"Deleted user: {userToDelete?.Name} ({userToDelete?.Email})",
                    null,
                    HttpContext);

                return Ok(new { message = "User deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user");
                return StatusCode(500, "An error occurred while deleting user");
            }
        }

        [HttpGet("users/{userId}")]
        public async Task<ActionResult<UserListDto>> GetUserById(Guid userId)
        {
            try
            {
                var currentUserId = _userContext.GetCurrentUserId();
                var currentUserRole = _userContext.GetCurrentUserRole();
                if (currentUserId == null || string.IsNullOrEmpty(currentUserRole))
                    return Unauthorized("User not authenticated");

                var user = await _userManagementService.GetUserByIdAsync(userId, currentUserId.Value, currentUserRole);
                if (user == null)
                    return NotFound("User not found or you don't have permission to view this user");

                return Ok(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user");
                return StatusCode(500, "An error occurred while retrieving user");
            }
        }
    }
}

