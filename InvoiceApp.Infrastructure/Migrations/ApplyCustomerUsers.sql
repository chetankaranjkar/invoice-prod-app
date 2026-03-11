-- Run this script in SSMS or your SQL client to create the CustomerUsers table
-- (Alternative to: dotnet ef database update)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerUsers')
BEGIN
    CREATE TABLE [dbo].[CustomerUsers] (
        [CustomerId] INT NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT [PK_CustomerUsers] PRIMARY KEY ([CustomerId], [UserId]),
        CONSTRAINT [FK_CustomerUsers_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_CustomerUsers_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_CustomerUsers_UserId] ON [dbo].[CustomerUsers] ([UserId]);

    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20260301161607_AddCustomerUserSharing', '9.0.9');
END
GO
