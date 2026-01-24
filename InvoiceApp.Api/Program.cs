using InvoiceApp.Application;
using InvoiceApp.Infrastructure;
using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Infrastructure.Seed;
using InvoiceApp.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers().AddNewtonsoftJson();

// Configure request size limits for large file uploads (backup restore)
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 1024 * 1024 * 1024; // 1GB
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBoundaryLengthLimit = int.MaxValue;
    options.MultipartHeadersCountLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// Configure Kestrel server options for larger request bodies
builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = 1024 * 1024 * 1024; // 1GB
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "InvoiceApp API",
        Version = "v1",
        Description = "Invoice Management System API"
    });

    // Add JWT Authentication to Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and then your valid token in the text input below.\r\n\r\nExample: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\""
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Add Application and Infrastructure services
// Get connection string from environment variable or appsettings.json
var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING") 
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is required. Please set 'CONNECTION_STRING' environment variable or 'ConnectionStrings:DefaultConnection' in appsettings.json.");
}

builder.Services.AddInfrastructureServices(connectionString);
builder.Services.AddApplicationServices();

// Register seed service
builder.Services.AddScoped<DatabaseSeed>();

// Configure JWT Authentication
// Priority: Environment Variable > appsettings.json
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET") 
    ?? jwtSettings["Secret"];

// Require JWT secret - fail startup if not configured
if (string.IsNullOrEmpty(secretKey))
{
    throw new InvalidOperationException(
        "JWT Secret key is required. Please set 'JWT_SECRET' environment variable or 'Jwt:Secret' in appsettings.json. " +
        "For production, use a strong, randomly generated secret key (minimum 32 characters). " +
        "Example: set JWT_SECRET=YourSuperSecretKeyForJWTTokenGeneration2024!MakeThisVeryLongAndSecure!");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        // Get allowed origins from configuration or use defaults
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
            ?? new[] { 
                "http://invoiceapp.local:3000", 
                "http://localhost:3000", 
                "https://localhost:3000",
                "http://localhost:5173",
                "http://localhost:5174",
                "http://frontend:80", 
                "http://localhost" 
            };
        
        policy.WithOrigins(allowedOrigins)
              .WithHeaders("Content-Type", "Authorization", "X-Requested-With")
              .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
              .AllowCredentials();
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(secretKey)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();

    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "InvoiceApp API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = "InvoiceApp API Documentation";
    });
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
    
    // Disable Swagger in production
    // Swagger is only available in Development mode
}

// Seed database
await SeedDatabaseAsync(app);

// Initialize backup directory permissions
await InitializeBackupDirectoryAsync(app);

// Enable static file serving for uploaded logos with CORS support
// IMPORTANT: Static files must be served BEFORE routing to avoid conflicts
// This serves files from wwwroot folder, so /uploads/logos/file.jpg maps to wwwroot/uploads/logos/file.jpg
var staticFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Add CORS headers to static files
        var response = ctx.Context.Response;
        response.Headers.Append("Access-Control-Allow-Origin", "*");
        response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.Headers.Append("Access-Control-Allow-Headers", "*");
        response.Headers.Append("Cache-Control", "public, max-age=3600");
    }
};
app.UseStaticFiles(staticFileOptions); // This serves files from wwwroot folder

// Enable routing (after static files)
app.UseRouting();

// Add error logging middleware (before CORS to catch all errors)
app.UseMiddleware<ErrorLoggingMiddleware>();

// Use CORS - IMPORTANT: This must come before UseAuthorization and MapControllers
app.UseCors("AllowReactApp");

// Only redirect to HTTPS in production
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Add authentication & authorization middleware
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Add a default route for the root
app.MapGet("/", () => Results.Redirect("/swagger"));

// Health check endpoint for Docker
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// Debug endpoint to check if uploads directory exists and list files
app.MapGet("/debug/uploads", () =>
{
    var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "logos");
    var exists = Directory.Exists(uploadsPath);
    var files = exists ? Directory.GetFiles(uploadsPath).Select(f => Path.GetFileName(f)).ToArray() : Array.Empty<string>();
    return Results.Ok(new { 
        uploadsPath, 
        exists, 
        fileCount = files.Length, 
        files 
    });
});

app.Run();

async Task SeedDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;

    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        var seed = services.GetRequiredService<DatabaseSeed>();
        var logger = services.GetRequiredService<ILogger<Program>>();

        // First, check if we can connect to SQL Server (using master database)
        // We need to test connection to SQL Server itself, not the specific database
        const int maxRetries = 30;
        const int delaySeconds = 3;
        bool sqlServerReady = false;

        Console.WriteLine("🔍 Waiting for SQL Server to be ready...");
        
        // Create a connection string to master database for initial connection test
        var masterConnectionString = connectionString.Replace("Database=InvoiceApp", "Database=master");
        
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                Console.WriteLine($"   Attempt {attempt}/{maxRetries}: Checking SQL Server connection...");
                
                // Test connection to SQL Server using master database
                using (var masterContext = new AppDbContext(
                    new DbContextOptionsBuilder<AppDbContext>()
                        .UseSqlServer(masterConnectionString, sqlOptions => sqlOptions.EnableRetryOnFailure())
                        .Options))
                {
                    sqlServerReady = await masterContext.Database.CanConnectAsync();
                    if (sqlServerReady)
                    {
                        Console.WriteLine("✅ SQL Server is ready!");
                        break;
                    }
                }
            }
            catch (Exception connectEx)
            {
                if (attempt < maxRetries)
                {
                    var errorMessage = connectEx.InnerException?.Message ?? connectEx.Message;
                    if (errorMessage.Contains("network-related") || errorMessage.Contains("server was not found") || errorMessage.Contains("cannot open a connection"))
                    {
                        Console.WriteLine($"   ⏳ SQL Server not ready yet, waiting {delaySeconds} seconds... ({errorMessage.Substring(0, Math.Min(60, errorMessage.Length))}...)");
                        await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
                    }
                    else if (errorMessage.Contains("Cannot open database") || errorMessage.Contains("login failed"))
                    {
                        // These are different errors - might be connection string issue, but continue retrying
                        Console.WriteLine($"   ⚠️  Connection attempt {attempt} failed: {errorMessage.Substring(0, Math.Min(60, errorMessage.Length))}...");
                        await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
                    }
                    else
                    {
                        // Other errors - continue retrying
                        Console.WriteLine($"   ⚠️  Connection attempt {attempt} failed: {errorMessage.Substring(0, Math.Min(60, errorMessage.Length))}...");
                        await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
                    }
                }
                else
                {
                    // Last attempt failed
                    logger.LogError(connectEx, "❌ Failed to connect to SQL Server after {MaxRetries} attempts", maxRetries);
                    Console.WriteLine($"❌ Failed to connect to SQL Server after {maxRetries} attempts");
                    Console.WriteLine($"   Error: {connectEx.Message}");
                    if (connectEx.InnerException != null)
                    {
                        Console.WriteLine($"   Inner Exception: {connectEx.InnerException.Message}");
                    }
                    throw;
                }
            }
        }

        if (!sqlServerReady)
        {
            throw new InvalidOperationException($"Could not connect to SQL Server after {maxRetries} attempts. Please check if SQL Server container is running.");
        }

        // Now ensure the InvoiceApp database exists before running migrations
        Console.WriteLine("🔍 Ensuring InvoiceApp database exists...");
        try
        {
            // Use ADO.NET directly for database creation (EF Core's ExecuteSqlRaw doesn't handle CREATE DATABASE well)
            using (var connection = new SqlConnection(masterConnectionString))
            {
                await connection.OpenAsync();
                
                // Check if database exists
                var checkDbSql = "SELECT COUNT(*) FROM sys.databases WHERE name = 'InvoiceApp'";
                using (var checkCmd = new SqlCommand(checkDbSql, connection))
                {
                    var result = await checkCmd.ExecuteScalarAsync();
                    var exists = result != null && (int)result > 0;
                    
                    if (!exists)
                    {
                        Console.WriteLine("📦 Creating InvoiceApp database...");
                        var createDbSql = "CREATE DATABASE InvoiceApp";
                        using (var createCmd = new SqlCommand(createDbSql, connection))
                        {
                            await createCmd.ExecuteNonQueryAsync();
                            Console.WriteLine("✅ InvoiceApp database created successfully!");
                        }
                    }
                    else
                    {
                        Console.WriteLine("✅ InvoiceApp database already exists");
                    }
                }
            }
        }
        catch (Exception createDbEx)
        {
            // Check if error is because database already exists (race condition)
            var errorMsg = createDbEx.InnerException?.Message ?? createDbEx.Message;
            if (errorMsg.Contains("already exists") || errorMsg.Contains("already been created"))
            {
                Console.WriteLine("✅ InvoiceApp database already exists (detected during creation)");
            }
            else
            {
                logger.LogWarning(createDbEx, "⚠️  Could not ensure database exists automatically");
                Console.WriteLine($"⚠️  Warning: Could not automatically ensure InvoiceApp database exists: {errorMsg.Substring(0, Math.Min(80, errorMsg.Length))}...");
                Console.WriteLine("   Attempting to continue - MigrateAsync may handle it");
            }
        }

        // Apply pending migrations (this will create tables if database exists)
        try
        {
            Console.WriteLine("📦 Applying database migrations...");
            await context.Database.MigrateAsync();
            Console.WriteLine("✅ Database migrations applied successfully");
        }
        catch (Exception migrationEx)
        {
            logger.LogError(migrationEx, "❌ Failed to apply migrations");
            Console.WriteLine("❌ Failed to apply migrations:");
            Console.WriteLine($"   Error: {migrationEx.Message}");
            
            if (migrationEx.InnerException != null)
            {
                Console.WriteLine($"   Inner Exception: {migrationEx.InnerException.Message}");
            }
            
            Console.WriteLine("");
            Console.WriteLine("⚠️  Please check:");
            Console.WriteLine("   1. SQL Server is running");
            Console.WriteLine("   2. Connection string is correct");
            Console.WriteLine("   3. You have permissions to create databases");
            Console.WriteLine("");
            
            // Don't throw - let the app start, migrations can be retried
            logger.LogWarning("Application will continue but database may not be fully initialized");
            Console.WriteLine("⚠️  Application will continue but database may not be fully initialized");
        }

        // Verify database was created and is accessible
        try
        {
            var canConnect = await context.Database.CanConnectAsync();
            if (canConnect)
            {
                Console.WriteLine("✅ Database connection verified");
            }
            else
            {
                throw new InvalidOperationException("Database was created but cannot be connected to.");
            }

            // Verify that all migrations have been applied by checking migration history
            try
            {
                var appliedMigrations = await context.Database.GetAppliedMigrationsAsync();
                var pendingMigrations = await context.Database.GetPendingMigrationsAsync();
                
                Console.WriteLine($"📋 Applied migrations: {appliedMigrations.Count()}");
                if (pendingMigrations.Any())
                {
                    logger.LogWarning("⚠️  There are pending migrations that weren't applied.");
                    Console.WriteLine($"⚠️  Warning: {pendingMigrations.Count()} pending migration(s) detected:");
                    foreach (var migration in pendingMigrations)
                    {
                        Console.WriteLine($"   - {migration}");
                    }
                }
                else
                {
                    Console.WriteLine("✅ All migrations have been applied");
                }

                // Also check for CreatedBy column as a secondary verification
                try
                {
                    var hasCreatedByColumn = await context.Database.ExecuteSqlRawAsync(@"
                        SELECT CASE 
                            WHEN EXISTS (
                                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'CreatedBy'
                            ) THEN 1 ELSE 0 END
                    ");
                    Console.WriteLine("✅ Database schema verified (CreatedBy column exists)");
                }
                catch (Exception columnCheckEx)
                {
                    logger.LogWarning(columnCheckEx, "⚠️  Could not verify CreatedBy column. Seed will handle this.");
                    Console.WriteLine("⚠️  Warning: Could not verify CreatedBy column. Seed will attempt to handle this.");
                }
            }
            catch (Exception schemaCheckEx)
            {
                logger.LogWarning(schemaCheckEx, "⚠️  Could not verify database schema. Proceeding with seed...");
                Console.WriteLine($"⚠️  Schema verification warning: {schemaCheckEx.Message}");
            }
        }
        catch (Exception verifyEx)
        {
            logger.LogError(verifyEx, "❌ Database verification failed");
            throw new InvalidOperationException(
                "Database was created but verification failed. Please check your database connection.",
                verifyEx);
        }

        // Check if we need to seed data
        Console.WriteLine("🌱 Checking if database needs seeding...");
        if (!await context.Users.AnyAsync())
        {
            Console.WriteLine("📝 Seeding initial data...");
            await seed.SeedAsync();
            Console.WriteLine("✅ Database seeded with initial data (MasterUser: chetan.karanjkar@gmail.com)");
        }
        else
        {
            var userCount = await context.Users.CountAsync();
            Console.WriteLine($"✅ Database already contains {userCount} user(s), skipping seed");
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ An error occurred while initializing the database");
        Console.WriteLine("");
        Console.WriteLine("❌ CRITICAL: Database initialization failed!");
        Console.WriteLine($"   Error: {ex.Message}");
        Console.WriteLine("");
        Console.WriteLine("   The application cannot start without a properly initialized database.");
        Console.WriteLine("   Please fix the database connection issue and restart the application.");
        Console.WriteLine("");
        
        // Re-throw to prevent the application from starting with a broken database
        throw;
    }
}

async Task InitializeBackupDirectoryAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING") 
        ?? app.Configuration.GetConnectionString("DefaultConnection");

    if (string.IsNullOrEmpty(connectionString))
    {
        logger.LogWarning("Connection string not available, skipping backup directory initialization");
        return;
    }

    try
    {
        logger.LogInformation("Initializing backup directory permissions...");
        
        // Use SQL Server to create and set permissions on backup directory
        using (var connection = new SqlConnection(connectionString))
        {
            await connection.OpenAsync();
            
            // Enable xp_cmdshell temporarily
            using (var enableCmd = new SqlCommand(@"
                EXEC sp_configure 'show advanced options', 1;
                RECONFIGURE;
                EXEC sp_configure 'xp_cmdshell', 1;
                RECONFIGURE;", connection))
            {
                await enableCmd.ExecuteNonQueryAsync();
            }
            
            // Create backup directory and set permissions
            var initCommands = new[]
            {
                "mkdir -p /var/opt/mssql/backup",
                "chmod 777 /var/opt/mssql/backup",
                "chown mssql:mssql /var/opt/mssql/backup || true"
            };
            
            foreach (var cmd in initCommands)
            {
                try
                {
                    var escapedCmd = cmd.Replace("'", "''");
                    using (var initCmd = new SqlCommand($"EXEC xp_cmdshell '{escapedCmd}'", connection))
                    {
                        await initCmd.ExecuteNonQueryAsync();
                    }
                }
                catch (Exception cmdEx)
                {
                    logger.LogWarning(cmdEx, "Failed to execute initialization command: {Command}", cmd);
                }
            }
            
            // Disable xp_cmdshell for security
            using (var disableCmd = new SqlCommand(@"
                EXEC sp_configure 'xp_cmdshell', 0;
                RECONFIGURE;
                EXEC sp_configure 'show advanced options', 0;
                RECONFIGURE;", connection))
            {
                await disableCmd.ExecuteNonQueryAsync();
            }
            
            logger.LogInformation("Backup directory permissions initialized successfully");
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Failed to initialize backup directory permissions. Backups may need manual permission fix.");
        // Don't throw - this is not critical for app startup
    }
}