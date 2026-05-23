-- Example seed: Application Cost with informational sub-products (per user — replace @UserId)
DECLARE @UserId uniqueidentifier = '00000000-0000-0000-0000-000000000000';

INSERT INTO Products (UserId, Name, ProductType, ParentProductId, DefaultRate, DefaultGstPercentage, AffectTotal, Taxable, InheritGstFromParent, Description, IsActive, CreatedAt, UpdatedAt)
VALUES (@UserId, N'Application Cost', N'parent', NULL, 100000.00, 18.00, 1, 1, 0, N'Main billable application package', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

DECLARE @ParentId int = SCOPE_IDENTITY();

INSERT INTO Products (UserId, Name, ProductType, ParentProductId, DefaultRate, DefaultGstPercentage, AffectTotal, Taxable, InheritGstFromParent, Description, IsActive, CreatedAt, UpdatedAt)
VALUES
(@UserId, N'Frontend Development', N'sub', @ParentId, 0.00, 18.00, 0, 0, 1, N'UI implementation breakdown', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
(@UserId, N'API Development', N'sub', @ParentId, 0.10, 18.00, 0, 0, 1, N'Backend API breakdown', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
(@UserId, N'SQL Setup', N'sub', @ParentId, 0.00, 18.00, 0, 0, 1, N'Database setup breakdown', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
