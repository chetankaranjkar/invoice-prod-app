using System;

namespace InvoiceApp.Application.Interfaces
{
    public interface IUserContext
    {
        Guid? GetCurrentUserId();
        string? GetCurrentUserEmail();
        string? GetCurrentUserName();
        string? GetCurrentUserRole();
        bool IsAuthenticated();
    }
}