using InvoiceApp.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace InvoiceApp.Api.Middleware
{
    public class ErrorLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorLoggingMiddleware> _logger;

        public ErrorLoggingMiddleware(RequestDelegate next, ILogger<ErrorLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, IErrorLogService errorLogService, IUserContext userContext)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                // Log the error
                try
                {
                    var userId = userContext.GetCurrentUserId()?.ToString();
                    var userEmail = userContext.GetCurrentUserEmail();
                    var requestPath = context.Request.Path.Value;
                    var requestMethod = context.Request.Method;
                    var queryString = context.Request.QueryString.Value;
                    var userAgent = context.Request.Headers["User-Agent"].ToString();
                    var ipAddress = context.Connection.RemoteIpAddress?.ToString();

                    // Read request body if available (only for POST/PUT/PATCH)
                    string? requestBody = null;
                    if ((context.Request.Method == "POST" || context.Request.Method == "PUT" || context.Request.Method == "PATCH") 
                        && context.Request.Body.CanSeek)
                    {
                        try
                        {
                            context.Request.Body.Position = 0;
                            using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true))
                            {
                                requestBody = await reader.ReadToEndAsync();
                                context.Request.Body.Position = 0;
                            }
                        }
                        catch
                        {
                            // If reading body fails, continue without it
                        }
                    }

                    await errorLogService.LogErrorAsync(
                        ex,
                        userId: userId,
                        userEmail: userEmail,
                        requestPath: requestPath,
                        requestMethod: requestMethod,
                        requestBody: requestBody,
                        queryString: queryString,
                        userAgent: userAgent,
                        ipAddress: ipAddress
                    );
                }
                catch (Exception logEx)
                {
                    // If error logging fails, log to standard logger
                    _logger.LogError(logEx, "Failed to log error to database. Original error: {OriginalError}", ex.Message);
                }

                // Re-throw to let the error handling pipeline handle it
                throw;
            }
        }
    }
}
