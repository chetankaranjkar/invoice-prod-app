@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Invoice Master - Full IIS Setup
echo   1. Prerequisites
echo   2. Deploy to IIS
echo ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
    exit /b
)

echo.
echo [Step 1/2] Installing prerequisites...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-iis-prerequisites.ps1" -IncludeDevTools -IncludeSqlServer -NoPause %*
if %errorlevel% neq 0 (
    echo.
    echo Prerequisites step failed. Fix issues above and try again.
    pause
    exit /b %errorlevel%
)

echo.
echo [Step 2/2] Deploying to IIS...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-iis.ps1" -NoPause %*
set EXITCODE=%errorlevel%

if %EXITCODE% neq 0 (
    echo.
    echo Deployment failed with exit code %EXITCODE%.
    pause
    exit /b %EXITCODE%
)

echo.
echo Full setup complete. Open http://localhost in your browser.
pause
exit /b 0
