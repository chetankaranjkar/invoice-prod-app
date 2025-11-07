using InvoiceApp.Application;
using InvoiceApp.Infrastructure;
using InvoiceApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using InvoiceApp.Infrastructure.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers().AddNewtonsoftJson();
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
builder.Services.AddInfrastructureServices(builder.Configuration.GetConnectionString("DefaultConnection"));
builder.Services.AddApplicationServices();

// Register seed service
builder.Services.AddScoped<DatabaseSeed>();

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSettings["Secret"] ?? "YourSuperSecretKeyForJWTTokenGeneration2024!";

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
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
}

// Enable static file serving for uploaded logos
app.UseStaticFiles(); // This serves files from wwwroot folder

// Seed database
await SeedDatabaseAsync(app);
// Use CORS - IMPORTANT: This must come before UseAuthorization and MapControllers
app.UseCors("AllowReactApp");

app.UseHttpsRedirection();

// Add authentication & authorization middleware
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Add a default route for the root
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();

async Task SeedDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;

    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        var seed = services.GetRequiredService<DatabaseSeed>();

        // Check if database exists and create if not
        await context.Database.EnsureCreatedAsync();

        // Check if we need to seed data
        if (!await context.Users.AnyAsync())
        {
            await seed.SeedAsync();
            Console.WriteLine("✅ Database seeded with initial data");
        }
        else
        {
            Console.WriteLine("✅ Database already contains data, skipping seed");
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ An error occurred while seeding the database");
    }
}