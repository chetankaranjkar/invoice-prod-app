# Error Log Migration Guide

This guide explains how to create the database migration for the ErrorLog table.

## Create Migration

Run this command from the `InvoiceApp.Infrastructure` project directory or from the solution root:

```bash
dotnet ef migrations add AddErrorLogTable --project InvoiceApp.Infrastructure --startup-project InvoiceApp.Api
```

Or if you're in the Infrastructure directory:

```bash
dotnet ef migrations add AddErrorLogTable --startup-project ../InvoiceApp.Api/InvoiceApp.Api.csproj
```

## Apply Migration

The migration will be automatically applied when the API starts (if automatic migrations are enabled in Program.cs).

Or manually apply:

```bash
dotnet ef database update --project InvoiceApp.Infrastructure --startup-project InvoiceApp.Api
```

## What the Migration Creates

The ErrorLog table with the following columns:
- `Id` (int, primary key)
- `ErrorType` (nvarchar(100), required)
- `Message` (nvarchar(2000), required)
- `StackTrace` (nvarchar(max), nullable)
- `InnerException` (nvarchar(max), nullable)
- `Source` (nvarchar(500), nullable)
- `UserId` (nvarchar(100), nullable)
- `UserEmail` (nvarchar(200), nullable)
- `RequestPath` (nvarchar(500), nullable)
- `RequestMethod` (nvarchar(10), nullable)
- `RequestBody` (nvarchar(max), nullable)
- `QueryString` (nvarchar(1000), nullable)
- `UserAgent` (nvarchar(500), nullable)
- `IpAddress` (nvarchar(50), nullable)
- `AdditionalData` (nvarchar(max), nullable)
- `IsResolved` (bit, default false)
- `ResolvedBy` (nvarchar(200), nullable)
- `ResolvedAt` (datetime2, nullable)
- `ResolutionNotes` (nvarchar(1000), nullable)
- `CreatedAt` (datetime2, required)
- `UpdatedAt` (datetime2, nullable)

## Indexes

The migration also creates indexes on:
- `CreatedAt`
- `IsResolved`
- `ErrorType`

## Docker Environment

If you're using Docker, the migration will be applied automatically when the API container starts, as configured in `Program.cs`.

## Verification

After migration, you can verify the table was created:

```sql
SELECT * FROM ErrorLogs;
```

Or check the table structure:

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'ErrorLogs';
```
