#Requires -Version 5.1
<#
.SYNOPSIS
    Installs IIS and runtime prerequisites for Invoice Master on Windows.

.DESCRIPTION
    Enables IIS, installs .NET 8 Hosting Bundle, URL Rewrite, ARR, and optionally
    dev tools (SDK, Node.js) and SQL Server Express + SSMS.

    Run install-iis-prerequisites.bat as Administrator, then deploy-iis.bat.

.PARAMETER IncludeDevTools
    Install .NET 8 SDK and Node.js LTS (needed to build on this PC).

.PARAMETER IncludeSqlServer
    Install SQL Server 2022 Express and SSMS via winget (large download).

.PARAMETER RunDeploy
    Run deploy-iis.ps1 after prerequisites are installed.

.PARAMETER SqlServer
    SQL Server instance passed to deploy-iis.ps1 when -RunDeploy is used.

.EXAMPLE
    .\install-iis-prerequisites.ps1
    .\install-iis-prerequisites.ps1 -IncludeDevTools -IncludeSqlServer -RunDeploy
#>

[CmdletBinding()]
param(
    [switch]$IncludeDevTools,
    [switch]$IncludeSqlServer,
    [switch]$RunDeploy,
    [string]$SqlServer = ".",
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [switch]$AddLocalDomain,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SetupDir = Join-Path $env:TEMP "InvoiceAppSetup"
$ScriptRoot = $PSScriptRoot

# Microsoft installer URLs (verified). Older GUIDs return 404.
$UrlRewriteUrls = @(
    "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
)
$ArrUrls = @(
    "https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi"
)

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-IsAdministrator {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-CommandAvailable([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-WingetAvailable {
    return Test-CommandAvailable "winget"
}

function Test-IisEnabled {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -ErrorAction SilentlyContinue
    return $feature -and $feature.State -eq "Enabled"
}

function Test-HostingBundleInstalled {
    return Test-Path "$env:SystemRoot\System32\inetsrv\aspnetcorev2.dll"
}

function Test-UrlRewriteInstalled {
    if (-not (Test-CommandAvailable "Get-WebGlobalModule")) {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
    }
    if (Test-CommandAvailable "Get-WebGlobalModule") {
        return [bool](Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue)
    }
    return Test-Path "${env:ProgramFiles}\IIS\Microsoft URL Rewrite\rewrite.dll"
}

function Test-ArrInstalled {
    if (-not (Test-CommandAvailable "Get-WebGlobalModule")) {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
    }
    if (Test-CommandAvailable "Get-WebGlobalModule") {
        return [bool](Get-WebGlobalModule -Name "ApplicationRequestRouting" -ErrorAction SilentlyContinue)
    }
    return Test-Path "${env:ProgramFiles}\IIS\Application Request Routing\requestRouter.dll"
}

function Test-DotNetSdkInstalled {
    if (-not (Test-CommandAvailable "dotnet")) { return $false }
    $sdk = & dotnet --list-sdks 2>$null
    return ($sdk | Where-Object { $_ -match '^8\.' }) -ne $null
}

function Test-NodeInstalled {
    return Test-CommandAvailable "npm"
}

function Test-SqlServerReachable {
    param([string]$Server = ".")
    $sqlcmd = Get-SqlCmdPath
    if (-not $sqlcmd) { return $false }
    & $sqlcmd -S $Server -E -Q "SELECT 1" -h -1 -W 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-SqlCmdPath {
    $candidates = @(
        "sqlcmd",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -eq "sqlcmd") {
            $cmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
            continue
        }
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$Label
    )

    if (-not (Test-WingetAvailable)) {
        Write-Warn "winget not available. Install $Label manually."
        return $false
    }

    Write-Host "  Installing $Label via winget ($Id)..."
    & winget install --id $Id --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        # -1978335189 = already installed
        Write-Warn "winget install returned exit code $LASTEXITCODE for $Label"
        return $false
    }

    Write-Ok "$Label installed (or already present)"
    return $true
}

function Install-MsiPackage {
    param(
        [string[]]$Urls,
        [string]$FileName,
        [string]$Label
    )

    if (-not (Test-Path $SetupDir)) {
        New-Item -ItemType Directory -Path $SetupDir -Force | Out-Null
    }

    $msiPath = Join-Path $SetupDir $FileName
    $downloaded = Test-Path $msiPath

    if (-not $downloaded) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        foreach ($url in $Urls) {
            try {
                Write-Host "  Downloading $Label..."
                Write-Host "    $url"
                Invoke-WebRequest -Uri $url -OutFile $msiPath -UseBasicParsing -TimeoutSec 120 `
                    -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) InvoiceAppSetup"
                if ((Test-Path $msiPath) -and (Get-Item $msiPath).Length -gt 100000) {
                    $downloaded = $true
                    break
                }
                Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
            }
            catch {
                Write-Warn "Download failed: $($_.Exception.Message)"
                if (Test-Path $msiPath) {
                    Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }

    if (-not $downloaded) {
        Write-Warn "Could not download $Label from Microsoft CDN."
        return $false
    }

    Write-Host "  Installing $Label..."
    $arguments = "/i `"$msiPath`" /qn /norestart"
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
        Write-Warn "$Label installer exit code: $($process.ExitCode)"
        return $false
    }

    Write-Ok "$Label installed"
    return $true
}

function Install-IisExtension {
    param(
        [string]$Label,
        [scriptblock]$TestInstalled,
        [string]$WingetId,
        [string[]]$MsiUrls,
        [string]$MsiFileName,
        [string]$ManualUrl
    )

    if (& $TestInstalled) {
        Write-Ok "$Label already installed"
        return $true
    }

    Write-Step "Installing $Label..."

    if ($WingetId -and (Test-WingetAvailable)) {
        if (Install-WingetPackage -Id $WingetId -Label $Label) {
            Start-Sleep -Seconds 2
            if (& $TestInstalled) { return $true }
        }
    }

    if (Install-MsiPackage -Urls $MsiUrls -FileName $MsiFileName -Label $Label) {
        Start-Sleep -Seconds 2
        if (& $TestInstalled) { return $true }
    }

    Write-Warn "Install $Label manually: $ManualUrl"
    return $false
}

function Enable-IisFeatures {
  Write-Step "Enabling IIS Windows features..."

  $features = @(
    "IIS-WebServerRole",
    "IIS-WebServer",
    "IIS-CommonHttpFeatures",
    "IIS-StaticContent",
    "IIS-DefaultDocument",
    "IIS-HttpErrors",
    "IIS-ApplicationDevelopment",
    "IIS-NetFxExtensibility45",
    "IIS-ASPNET45",
    "IIS-HealthAndDiagnostics",
    "IIS-HttpLogging",
    "IIS-Security",
    "IIS-RequestFiltering",
    "IIS-Performance",
    "IIS-WebServerManagementTools",
    "IIS-ManagementConsole",
    "IIS-WebSockets"
  )

  $needsReboot = $false
  foreach ($feature in $features) {
    $state = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue
    if ($state -and $state.State -eq "Enabled") {
      Write-Host "  Already enabled: $feature"
      continue
    }

    Write-Host "  Enabling $feature..."
    $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart -ErrorAction Stop
    if ($result.RestartNeeded) { $needsReboot = $true }
  }

  if ($needsReboot) {
    Write-Warn "A Windows restart may be required for IIS features."
  }
  else {
    Write-Ok "IIS features enabled"
  }
}

function Enable-ArrProxy {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    if (-not (Test-CommandAvailable "Set-WebConfigurationProperty")) { return }

    try {
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
        Write-Ok "ARR reverse proxy enabled"
    }
    catch {
        Write-Warn "Could not enable ARR proxy yet: $($_.Exception.Message)"
    }
}

function Show-PrerequisiteReport {
    $rows = @(
        [pscustomobject]@{ Component = "IIS"; Installed = (Test-IisEnabled) },
        [pscustomobject]@{ Component = ".NET 8 Hosting Bundle"; Installed = (Test-HostingBundleInstalled) },
        [pscustomobject]@{ Component = "IIS URL Rewrite"; Installed = (Test-UrlRewriteInstalled) },
        [pscustomobject]@{ Component = "IIS ARR"; Installed = (Test-ArrInstalled) },
        [pscustomobject]@{ Component = ".NET 8 SDK (dev)"; Installed = (Test-DotNetSdkInstalled) },
        [pscustomobject]@{ Component = "Node.js / npm (dev)"; Installed = (Test-NodeInstalled) },
        [pscustomobject]@{ Component = "SQL Server (sqlcmd)"; Installed = [bool](Get-SqlCmdPath) }
    )

    Write-Host ""
    Write-Host "Prerequisite status:" -ForegroundColor Yellow
    foreach ($row in $rows) {
        $status = if ($row.Installed) { "OK" } else { "MISSING" }
        $color = if ($row.Installed) { "Green" } else { "Red" }
        Write-Host ("  {0,-28} {1}" -f $row.Component, $status) -ForegroundColor $color
    }

    $requiredOk = (Test-IisEnabled) -and (Test-HostingBundleInstalled) -and (Test-UrlRewriteInstalled) -and (Test-ArrInstalled)
    return $requiredOk
}

# ---------------------------------------------------------------------------
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Invoice Master - IIS Prerequisites Installer" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if (-not (Test-IsAdministrator)) {
    Write-Err "Run as Administrator. Double-click install-iis-prerequisites.bat"
    exit 1
}

# IIS
if (-not (Test-IisEnabled)) {
    Enable-IisFeatures
}
else {
    Write-Ok "IIS already enabled"
}

# .NET 8 Hosting Bundle (required)
if (-not (Test-HostingBundleInstalled)) {
    Write-Step "Installing .NET 8 Hosting Bundle..."
    $installed = Install-WingetPackage -Id "Microsoft.DotNet.HostingBundle.8" -Label ".NET 8 Hosting Bundle"
    if (-not $installed) {
        Write-Warn "Open in browser: https://dotnet.microsoft.com/download/dotnet/8.0"
        Write-Warn "Download and install the 'Hosting Bundle' (not just Runtime)."
    }
}
else {
    Write-Ok ".NET 8 Hosting Bundle already installed"
}

# URL Rewrite
Install-IisExtension `
    -Label "IIS URL Rewrite" `
    -TestInstalled { Test-UrlRewriteInstalled } `
    -WingetId "Microsoft.IIS.URLRewrite" `
    -MsiUrls $UrlRewriteUrls `
    -MsiFileName "rewrite_amd64_en-US.msi" `
    -ManualUrl "https://www.iis.net/downloads/microsoft/url-rewrite" | Out-Null

# ARR
Install-IisExtension `
    -Label "IIS Application Request Routing (ARR)" `
    -TestInstalled { Test-ArrInstalled } `
    -WingetId "Microsoft.IIS.ApplicationRequestRouting" `
    -MsiUrls $ArrUrls `
    -MsiFileName "requestRouter_amd64.msi" `
    -ManualUrl "https://www.iis.net/downloads/microsoft/application-request-routing" | Out-Null

# Dev tools (SDK + Node) - for build machine
if ($IncludeDevTools) {
    if (-not (Test-DotNetSdkInstalled)) {
        Write-Step "Installing .NET 8 SDK..."
        Install-WingetPackage -Id "Microsoft.DotNet.SDK.8" -Label ".NET 8 SDK" | Out-Null
    }
    else {
        Write-Ok ".NET 8 SDK already installed"
    }

    if (-not (Test-NodeInstalled)) {
        Write-Step "Installing Node.js LTS..."
        Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -Label "Node.js LTS" | Out-Null
    }
    else {
        Write-Ok "Node.js already installed"
    }
}

# SQL Server Express + SSMS
if ($IncludeSqlServer) {
    Write-Step "Installing SQL Server 2022 Express and SSMS (large download, may take 15+ minutes)..."

    if (-not (Get-SqlCmdPath)) {
        Install-WingetPackage -Id "Microsoft.SQLServer.2022.Express" -Label "SQL Server 2022 Express" | Out-Null
    }
    else {
        Write-Ok "SQL Server tools already present"
    }

    $ssmsPath = "${env:ProgramFiles}\Microsoft SQL Server Management Studio 20\Common7\IDE\Ssms.exe"
    $ssmsPath20 = "${env:ProgramFiles(x86)}\Microsoft SQL Server Management Studio 20\Common7\IDE\Ssms.exe"
    if (-not ((Test-Path $ssmsPath) -or (Test-Path $ssmsPath20))) {
        Install-WingetPackage -Id "Microsoft.SQLServerManagementStudio" -Label "SQL Server Management Studio (SSMS)" | Out-Null
    }
    else {
        Write-Ok "SSMS already installed"
    }

    Write-Host ""
    Write-Warn "After SQL Express installs, default instance is usually .\SQLEXPRESS"
    Write-Warn "Use: deploy-iis.ps1 -SqlServer '.\SQLEXPRESS'"
}

# Refresh PATH for current session (winget installs)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Step "Restarting IIS..."
try {
    & iisreset | Out-Null
    Write-Ok "IIS restarted"
}
catch {
    Write-Warn "Could not run iisreset: $($_.Exception.Message)"
}

Enable-ArrProxy

$ready = Show-PrerequisiteReport

Write-Host ""
if ($ready) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " Prerequisites ready for IIS deployment" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Yellow
    if ($IncludeDevTools) {
        Write-Host "  Double-click deploy-iis.bat"
    }
    else {
        Write-Host "  Copy built app to this PC, then run deploy-iis.bat"
        Write-Host "  (or deploy-iis.ps1 -SkipBuild on customer PC)"
    }
}
else {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host " Some prerequisites still missing" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Install missing items manually, then re-run this script." -ForegroundColor Yellow
    Write-Host "Hosting Bundle: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Gray
    Write-Host "URL Rewrite:    https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Gray
    Write-Host "ARR:            https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Gray
}

if ($RunDeploy) {
    if (-not $ready) {
        Write-Err "Cannot run deploy - fix missing prerequisites first."
        exit 1
    }

    if ($IncludeDevTools) {
        Write-Step "Starting deployment (deploy-iis.ps1)..."
        $deployScript = Join-Path $ScriptRoot "deploy-iis.ps1"
        if (-not (Test-Path $deployScript)) {
            Write-Err "deploy-iis.ps1 not found at $deployScript"
            exit 1
        }

        $deployArgs = @{
            SqlServer   = $SqlServer
            DeployRoot  = $DeployRoot
            NoPause     = $true
        }
        if ($AddLocalDomain) { $deployArgs.AddLocalDomain = $true }

        & $deployScript @deployArgs
        exit $LASTEXITCODE
    }
    else {
        Write-Warn "-RunDeploy requires -IncludeDevTools (SDK + Node) to build on this machine."
        Write-Warn "On customer PC: run deploy-iis.bat with -SkipBuild after copying built files."
    }
}

if (-not $NoPause -and -not $RunDeploy) {
    Write-Host ""
    Write-Host "Press Enter to exit..."
    [void][System.Console]::ReadLine()
}

if (-not $ready) { exit 1 }
exit 0
