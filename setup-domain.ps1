# Script to add invoiceapp.local domain to Windows hosts file
# This script must be run as Administrator

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$domain = "invoiceapp.local"
$ipAddress = "127.0.0.1"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "InvoiceApp Domain Setup Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Checking hosts file..." -ForegroundColor Yellow

# Read current hosts file
$hostsContent = Get-Content $hostsPath -ErrorAction Stop

# Check if domain already exists
$domainExists = $hostsContent | Where-Object { $_ -match "^\s*$ipAddress\s+$domain" }

if ($domainExists) {
    Write-Host "Domain $domain already exists in hosts file." -ForegroundColor Green
    Write-Host "Entry: $domainExists" -ForegroundColor Gray
} else {
    Write-Host "Adding $domain to hosts file..." -ForegroundColor Yellow
    
    # Create backup
    $backupPath = "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $hostsPath $backupPath -Force
    Write-Host "Backup created: $backupPath" -ForegroundColor Gray
    
    # Add new entry
    $newEntry = "$ipAddress`t$domain"
    
    # Add to hosts file
    Add-Content -Path $hostsPath -Value "" -ErrorAction Stop
    Add-Content -Path $hostsPath -Value "# InvoiceApp Local Domain" -ErrorAction Stop
    Add-Content -Path $hostsPath -Value $newEntry -ErrorAction Stop
    
    Write-Host "Successfully added $domain to hosts file!" -ForegroundColor Green
    Write-Host "Entry: $newEntry" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now access the application at:" -ForegroundColor Yellow
Write-Host "  Frontend: http://invoiceapp.local:3000" -ForegroundColor White
Write-Host "  API:      http://localhost:5000" -ForegroundColor White
Write-Host "  Swagger:  http://localhost:5000/swagger" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
