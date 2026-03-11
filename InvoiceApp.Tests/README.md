# InvoiceApp.Tests

Comprehensive test project for the Invoice App backend.

## Test Coverage

### Unit Tests

- **InvoiceServiceTests** – Invoice business logic
  - Create invoice (MasterUser forbidden, customer validation, initial payment)
  - Get invoices (user, admin, MasterUser)
  - Get by ID (permissions, ownership)
  - Delete invoice
  - Add payment
  - Update invoice (with payments forbidden)
  - Duplicate invoice

- **InvoicesControllerTests** – Invoices API
  - Authentication checks
  - Role-based access (User, Admin, MasterUser)
  - CRUD operations

- **CustomersControllerTests** – Customers API
  - Authentication and authorization
  - CRUD and search

- **AuthControllerTests** – Auth API
  - Login (valid/invalid)
  - Register (success, duplicate email, failure)
  - Get current user

### Running Tests

```bash
# From solution root
dotnet test InvoiceApp.Tests/InvoiceApp.Tests.csproj

# With verbose output
dotnet test InvoiceApp.Tests/InvoiceApp.Tests.csproj -v n

# With coverage (requires coverlet)
dotnet test InvoiceApp.Tests/InvoiceApp.Tests.csproj --collect:"XPlat Code Coverage"
```

## Dependencies

- xUnit
- Moq (mocking)
- FluentAssertions (assertions)
- Microsoft.AspNetCore.Mvc.Testing (integration tests)
