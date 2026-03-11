# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files (needed for restore)
COPY InvoiceApp.sln ./
COPY InvoiceApp.Api/InvoiceApp.Api.csproj ./InvoiceApp.Api/
COPY InvoiceApp.Application/InvoiceApp.Application.csproj ./InvoiceApp.Application/
COPY InvoiceApp.Domain/InvoiceApp.Domain.csproj ./InvoiceApp.Domain/
COPY InvoiceApp.Infrastructure/InvoiceApp.Infrastructure.csproj ./InvoiceApp.Infrastructure/

# Restore dependencies (API project only - excludes InvoiceApp.Tests)
RUN dotnet restore InvoiceApp.Api/InvoiceApp.Api.csproj

# Copy all source code
COPY InvoiceApp.Api/ ./InvoiceApp.Api/
COPY InvoiceApp.Application/ ./InvoiceApp.Application/
COPY InvoiceApp.Domain/ ./InvoiceApp.Domain/
COPY InvoiceApp.Infrastructure/ ./InvoiceApp.Infrastructure/

# Build the application
WORKDIR "/src/InvoiceApp.Api"
RUN dotnet build InvoiceApp.Api.csproj -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
WORKDIR "/src/InvoiceApp.Api"
RUN dotnet publish InvoiceApp.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Install EF Core tools for migrations
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published application
COPY --from=publish /app/publish .

# Create directory for uploads
RUN mkdir -p /app/wwwroot/uploads/logos && \
    chmod 755 /app/wwwroot/uploads/logos

# Expose port
EXPOSE 8080

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application
ENTRYPOINT ["dotnet", "InvoiceApp.Api.dll"]
