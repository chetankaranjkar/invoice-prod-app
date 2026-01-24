@echo off
REM Batch file to run the PowerShell script as Administrator
REM This will prompt for Administrator privileges

echo =========================================
echo InvoiceApp Domain Setup
echo =========================================
echo.
echo This will add invoiceapp.local to your hosts file.
echo You will be prompted for Administrator privileges.
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is not available!
    pause
    exit /b 1
)

REM Run PowerShell script with elevated privileges
powershell -ExecutionPolicy Bypass -File "%~dp0setup-domain.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Setup failed. Please check the error messages above.
    pause
    exit /b 1
)
