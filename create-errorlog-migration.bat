@echo off
echo Creating ErrorLog migration...
echo.

cd /d "%~dp0"

dotnet ef migrations add AddErrorLogTable --project InvoiceApp.Infrastructure --startup-project InvoiceApp.Api

if errorlevel 1 (
    echo.
    echo [ERROR] Migration creation failed
    echo Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo [OK] Migration created successfully!
echo.
echo The migration will be applied automatically when the API starts.
echo Or you can apply it manually with: dotnet ef database update
echo.
pause
