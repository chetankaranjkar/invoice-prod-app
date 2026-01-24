# Error Logging System Guide

This guide explains the error logging system that automatically captures and stores all application errors.

## Overview

The error logging system:
- **Automatically logs all exceptions** that occur in the application
- **Stores detailed error information** including stack traces, request details, and user information
- **Provides a web interface** to view and manage errors
- **Allows marking errors as resolved** with notes

## Features

### Automatic Error Logging

All errors are automatically logged when they occur:
- **Global middleware** catches all unhandled exceptions
- **Controller-level errors** are logged with context
- **Database errors** are captured with full details
- **API errors** include request/response information

### Error Information Captured

Each error log includes:
- **Error Type** - Exception class name
- **Message** - Error message
- **Stack Trace** - Full stack trace
- **Inner Exception** - Inner exception details if any
- **User Information** - User ID and email (if authenticated)
- **Request Details** - Path, method, query string, body
- **Environment** - IP address, user agent
- **Additional Data** - Any custom data provided

### Error Management

- **View all errors** with pagination
- **Filter by resolved/unresolved** status
- **View error details** including full stack trace
- **Mark errors as resolved** with notes
- **View error statistics** (total, unresolved, last 24h, last 7 days)

## Accessing Error Logs

1. **Login** as Admin or MasterUser
2. **Navigate** to "Error Logs" in the navigation menu
3. **View errors** in the table
4. **Click "View"** to see full error details
5. **Mark as resolved** when the issue is fixed

## Error Log Page Features

### Statistics Dashboard

- **Total Errors** - All errors ever logged
- **Unresolved** - Errors that haven't been marked as resolved
- **Last 24 Hours** - Errors in the past day
- **Last 7 Days** - Errors in the past week

### Error List

- **Status Badge** - Shows if error is resolved or unresolved
- **Error Type** - Type of exception
- **Message Preview** - Truncated error message
- **User** - User who encountered the error
- **Request** - HTTP method and path
- **Date** - When the error occurred

### Error Details Modal

Click "View" on any error to see:
- Full error message
- Complete stack trace
- Inner exception details
- Request information (method, path, body, query string)
- User information
- IP address and user agent
- Additional data (if any)

### Resolving Errors

1. Click "View" on an unresolved error
2. Add resolution notes (optional)
3. Click "Mark as Resolved"
4. The error will be marked as resolved with your name and timestamp

## API Endpoints

All endpoints require Admin or MasterUser authentication:

- `GET /api/ErrorLog` - Get all errors (with pagination)
- `GET /api/ErrorLog/unresolved` - Get unresolved errors only
- `GET /api/ErrorLog/{id}` - Get error by ID
- `GET /api/ErrorLog/stats` - Get error statistics
- `POST /api/ErrorLog/{id}/resolve` - Mark error as resolved

## How It Works

### Global Error Middleware

The `ErrorLoggingMiddleware` catches all unhandled exceptions:
- Intercepts exceptions before they reach the error handler
- Extracts request information (path, method, body, headers)
- Gets user information from authentication context
- Logs the error to the database
- Re-throws the exception for normal error handling

### Controller-Level Logging

Controllers can also log errors explicitly:
```csharp
catch (Exception ex)
{
    await _errorLogService.LogErrorAsync(
        ex,
        userId: currentUserId?.ToString(),
        userEmail: currentUserEmail,
        requestPath: "/api/Backup/create",
        requestMethod: "POST"
    );
    // Handle error...
}
```

## Database Migration

To create the ErrorLog table, run:

```bash
create-errorlog-migration.bat
```

Or manually:

```bash
dotnet ef migrations add AddErrorLogTable --project InvoiceApp.Infrastructure --startup-project InvoiceApp.Api
```

The migration will be applied automatically when the API starts.

## Best Practices

1. **Review errors regularly** - Check unresolved errors daily
2. **Resolve errors promptly** - Mark errors as resolved when fixed
3. **Add resolution notes** - Document how the error was fixed
4. **Monitor error trends** - Watch for patterns in error types
5. **Use error logs for debugging** - Full stack traces help identify issues

## Troubleshooting

### Errors Not Appearing

- Check that the migration was applied: `SELECT * FROM ErrorLogs`
- Verify middleware is registered in `Program.cs`
- Check API logs for error logging failures

### Too Many Errors

- Review error patterns to identify root causes
- Fix common errors to reduce noise
- Consider filtering out known/expected errors

### Performance Impact

- Error logging is asynchronous and shouldn't impact performance
- Large request bodies are truncated if needed
- Old errors can be archived or deleted periodically

## Security

- **Error logs are sensitive** - They may contain user data, request bodies, etc.
- **Access is restricted** - Only Admin and MasterUser can view error logs
- **Resolution tracking** - All resolutions are logged with user information
- **Data retention** - Consider implementing data retention policies

## Support

If you encounter issues with error logging:
1. Check API logs: `docker-compose logs api`
2. Verify database connection
3. Check that ErrorLog table exists
4. Review middleware registration in Program.cs
