@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Invoice Master - Install Prerequisites
echo ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-iis-prerequisites.ps1" %*
set EXITCODE=%errorlevel%

if %EXITCODE% neq 0 (
    echo.
    echo Prerequisite install finished with issues. Exit code %EXITCODE%.
    pause
    exit /b %EXITCODE%
)

exit /b 0
