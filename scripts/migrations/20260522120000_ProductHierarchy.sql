-- Parent / Sub product hierarchy + invoice line hierarchy
-- Backward compatible: existing rows default to parent-like billable lines.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'ProductType')
BEGIN
    ALTER TABLE Products ADD ProductType nvarchar(20) NOT NULL CONSTRAINT DF_Products_ProductType DEFAULT 'parent';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'ParentProductId')
BEGIN
    ALTER TABLE Products ADD ParentProductId int NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'AffectTotal')
BEGIN
    ALTER TABLE Products ADD AffectTotal bit NOT NULL CONSTRAINT DF_Products_AffectTotal DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'Taxable')
BEGIN
    ALTER TABLE Products ADD Taxable bit NOT NULL CONSTRAINT DF_Products_Taxable DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'Description')
BEGIN
    ALTER TABLE Products ADD Description nvarchar(1000) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'IsActive')
BEGIN
    ALTER TABLE Products ADD IsActive bit NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Products') AND name = 'InheritGstFromParent')
BEGIN
    ALTER TABLE Products ADD InheritGstFromParent bit NOT NULL CONSTRAINT DF_Products_InheritGstFromParent DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Products_Products_ParentProductId')
BEGIN
    ALTER TABLE Products ADD CONSTRAINT FK_Products_Products_ParentProductId
        FOREIGN KEY (ParentProductId) REFERENCES Products(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_ParentProductId' AND object_id = OBJECT_ID(N'Products'))
BEGIN
    CREATE INDEX IX_Products_ParentProductId ON Products(ParentProductId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_UserId_ProductType' AND object_id = OBJECT_ID(N'Products'))
BEGIN
    CREATE INDEX IX_Products_UserId_ProductType ON Products(UserId, ProductType);
END
GO

-- Invoice line hierarchy
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'ParentInvoiceItemId')
BEGIN
    ALTER TABLE InvoiceItems ADD ParentInvoiceItemId int NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'HierarchyLevel')
BEGIN
    ALTER TABLE InvoiceItems ADD HierarchyLevel int NOT NULL CONSTRAINT DF_InvoiceItems_HierarchyLevel DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'AffectTotal')
BEGIN
    ALTER TABLE InvoiceItems ADD AffectTotal bit NOT NULL CONSTRAINT DF_InvoiceItems_AffectTotal DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'Taxable')
BEGIN
    ALTER TABLE InvoiceItems ADD Taxable bit NOT NULL CONSTRAINT DF_InvoiceItems_Taxable DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'DisplayOrder')
BEGIN
    ALTER TABLE InvoiceItems ADD DisplayOrder int NOT NULL CONSTRAINT DF_InvoiceItems_DisplayOrder DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'ShowOnInvoice')
BEGIN
    ALTER TABLE InvoiceItems ADD ShowOnInvoice bit NOT NULL CONSTRAINT DF_InvoiceItems_ShowOnInvoice DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'InvoiceItems') AND name = 'ProductId')
BEGIN
    ALTER TABLE InvoiceItems ADD ProductId int NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InvoiceItems_InvoiceItems_ParentInvoiceItemId')
BEGIN
    ALTER TABLE InvoiceItems ADD CONSTRAINT FK_InvoiceItems_InvoiceItems_ParentInvoiceItemId
        FOREIGN KEY (ParentInvoiceItemId) REFERENCES InvoiceItems(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InvoiceItems_Products_ProductId')
BEGIN
    ALTER TABLE InvoiceItems ADD CONSTRAINT FK_InvoiceItems_Products_ProductId
        FOREIGN KEY (ProductId) REFERENCES Products(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceItems_ParentInvoiceItemId' AND object_id = OBJECT_ID(N'InvoiceItems'))
BEGIN
    CREATE INDEX IX_InvoiceItems_ParentInvoiceItemId ON InvoiceItems(ParentInvoiceItemId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceItems_InvoiceId_DisplayOrder' AND object_id = OBJECT_ID(N'InvoiceItems'))
BEGIN
    CREATE INDEX IX_InvoiceItems_InvoiceId_DisplayOrder ON InvoiceItems(InvoiceId, DisplayOrder);
END
GO
