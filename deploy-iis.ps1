#Requires -Version 5.1
<#
.SYNOPSIS
    One-click IIS deployment for Invoice Master (API + React + SQL Server).

.DESCRIPTION
    Publishes the .NET 8 API, builds the React app, configures IIS sites,
    sets folder permissions, and optionally grants SQL Server access to the API app pool.

    Run deploy-iis.bat as Administrator (double-click) or:
      powershell -ExecutionPolicy Bypass -File .\deploy-iis.ps1

    First-time setup on a new PC:
      setup-iis-full.bat              (prerequisites + deploy)
      install-iis-prerequisites.bat   (prerequisites only)

.PARAMETER DeployRoot
    Target folder on this PC (default: C:\inetpub\InvoiceApp).

.PARAMETER SqlServer
    SQL Server instance (default: . for default instance, or .\SQLEXPRESS).

.PARAMETER SkipBuild
    Skip dotnet publish / npm build - use files already in DeployRoot.

.PARAMETER InstallIisFeatures
    Enable core IIS Windows features via DISM (requires reboot sometimes).

.EXAMPLE
    .\deploy-iis.ps1
    .\deploy-iis.ps1 -SqlServer ".\SQLEXPRESS" -DeployRoot "D:\InvoiceApp"
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$SqlServer = ".",
    [string]$DatabaseName = "InvoiceApp",
    [int]$ApiPort = 5001,
    [int]$WebPort = 80,
    [string]$ApiAppPool = "InvoiceAppApi",
    [string]$WebAppPool = "InvoiceAppWeb",
    [string]$ApiSiteName = "InvoiceApp-API",
    [string]$WebSiteName = "InvoiceApp-Web",
    [string]$JwtSecret = "",
    [switch]$SkipBuild,
    [switch]$InstallIisFeatures,
    [switch]$AddLocalDomain,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$ApiProject = Join-Path $RepoRoot "InvoiceApp.Api\InvoiceApp.Api.csproj"
$WebProject = Join-Path $RepoRoot "invoice-app"
$ApiDeployPath = Join-Path $DeployRoot "Api"
$WebDeployPath = Join-Path $DeployRoot "Web"
$ApiPoolIdentity = "IIS AppPool\$ApiAppPool"

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

function Stop-IfExists {
    param([string]$SiteName, [string]$AppPoolName)

    Import-Module WebAdministration -ErrorAction Stop

    try {
        if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
            Write-Host "  Stopping site: $SiteName"
            try { Stop-Website -Name $SiteName -ErrorAction Stop } catch { }
            Remove-Website -Name $SiteName -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Warn "Could not remove site ${SiteName}: $($_.Exception.Message)"
    }

    try {
        if (Test-Path "IIS:\AppPools\$AppPoolName") {
            Write-Host "  Removing app pool: $AppPoolName"
            try { Stop-WebAppPool -Name $AppPoolName -ErrorAction Stop } catch { }
            Start-Sleep -Seconds 1
            Remove-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Warn "Could not remove app pool ${AppPoolName}: $($_.Exception.Message)"
    }
}

function Stop-IisSitesForPublish {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    if (-not (Get-Module WebAdministration)) { return }

    foreach ($site in @($ApiSiteName, $WebSiteName)) {
        try {
            $website = Get-Website -Name $site -ErrorAction SilentlyContinue
            if ($website -and $website.State -ne "Stopped") {
                Write-Host "  Stopping site: $site"
                Stop-Website -Name $site -ErrorAction Stop
            }
            elseif ($website) {
                Write-Host "  Site already stopped: $site"
            }
        }
        catch {
            Write-Warn "Could not stop site ${site}: $($_.Exception.Message)"
        }
    }

    foreach ($pool in @($ApiAppPool, $WebAppPool)) {
        try {
            if (-not (Test-Path "IIS:\AppPools\$pool")) { continue }
            $state = (Get-WebAppPoolState -Name $pool).Value
            if ($state -ne "Stopped") {
                Write-Host "  Stopping app pool: $pool"
                Stop-WebAppPool -Name $pool -ErrorAction Stop
            }
            else {
                Write-Host "  App pool already stopped: $pool"
            }
        }
        catch {
            Write-Warn "Could not stop app pool ${pool}: $($_.Exception.Message)"
        }
    }

    # Give w3wp.exe time to release locked DLLs
    Start-Sleep -Seconds 3
}

function Remove-DeployFolder {
    param([string]$Path)

    if (-not (Test-Path $Path)) { return }

    $maxAttempts = 8
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object {
                    try { $_.Attributes = "Normal" } catch { }
                }
            Remove-Item $Path -Recurse -Force -ErrorAction Stop
            return
        }
        catch {
            if ($attempt -eq $maxAttempts) {
                throw "Could not remove '$Path' (files locked by IIS). Stop sites/app pools and retry. $($_.Exception.Message)"
            }
            Write-Warn "Folder locked (attempt $attempt/$maxAttempts). Stopping IIS workers and retrying..."
            Stop-IisSitesForPublish
            Start-Sleep -Seconds (2 * $attempt)
        }
    }
}

function Grant-FolderAcl {
    param(
        [string]$Path,
        [string[]]$Accounts,
        [string]$Rights = "M"
    )

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }

    foreach ($account in $Accounts) {
        if ([string]::IsNullOrWhiteSpace($account)) { continue }
        $output = & icacls $Path /grant "${account}:(OI)(CI)$Rights" /T 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "${account}: $($output -join ' ')"
        }
    }
}

function Enable-ArrProxySettings {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    try {
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "preserveHostHeader" -Value "False"
        return $true
    }
    catch {
        return $false
    }
}

function Enable-RewriteServerVariable {
    param([string]$Name)

    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $filter = "system.webServer/rewrite/allowedServerVariables"
    $existing = Get-WebConfiguration -PSPath "MACHINE/WEBROOT/APPHOST" -Filter $filter -ErrorAction SilentlyContinue
    if ($existing.Collection | Where-Object { $_.name -eq $Name }) {
        return
    }

    try {
        Add-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter $filter -Name "." -Value @{ name = $Name }
    }
    catch {
        Write-Warn "Could not allow rewrite server variable $Name at server level."
    }
}

function Set-ApiSiteLocalhostBinding {
    param(
        [string]$SiteName,
        [int]$Port
    )

    $bindings = @(Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue)
    foreach ($binding in $bindings) {
        $info = $binding.bindingInformation
        if ($info -and $info -ne "127.0.0.1:${Port}:") {
            Remove-WebBinding -Name $SiteName -BindingInformation $info -ErrorAction SilentlyContinue
        }
    }

    $hasLocalBinding = Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue |
        Where-Object { $_.bindingInformation -eq "127.0.0.1:${Port}:" }

    if (-not $hasLocalBinding) {
        New-WebBinding -Name $SiteName -Protocol "http" -IPAddress "127.0.0.1" -Port $Port | Out-Null
    }
}

function Get-SqlCmdPath {
    $candidates = @(
        "sqlcmd",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE"
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

function Get-LanIPv4Address {
    # Get-NetIPAddress can fail on some PCs ("Invalid class") — never block deploy.
    try {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($ip) { return $ip }
    }
    catch { }

    try {
        $entry = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName())
        $ip = $entry.AddressList |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.ToString() -notlike '127.*' } |
            Select-Object -First 1
        if ($ip) { return $ip.ToString() }
    }
    catch { }

    return $null
}

function Ensure-IisServicesRunning {
    foreach ($name in @("WAS", "W3SVC")) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $svc) {
            Write-Warn "Windows service not found: $name"
            continue
        }
        if ($svc.Status -ne "Running") {
            Write-Host "  Starting service: $name"
            try {
                Start-Service -Name $name -ErrorAction Stop
            }
            catch {
                Write-Warn "Could not start ${name}: $($_.Exception.Message)"
            }
        }
    }
    Start-Sleep -Seconds 2
}

function Start-IisAppPoolSafe {
    param([string]$AppPoolName)

    try {
        if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) { return }
        $state = (Get-WebAppPoolState -Name $AppPoolName).Value
        if ($state -eq "Started") { return }
        Start-WebAppPool -Name $AppPoolName -ErrorAction Stop
    }
    catch {
        Write-Warn "Start-WebAppPool ${AppPoolName}: $($_.Exception.Message)"
        Ensure-IisServicesRunning
        try { Start-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue } catch { }
    }
}

function Start-IisSiteSafe {
    param([string]$SiteName)

    $maxAttempts = 5
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
            if (-not $site) {
                throw "Site '$SiteName' does not exist"
            }
            if ($site.State -eq "Started") {
                Write-Host "  Site already started: $SiteName"
                return
            }

            Start-Website -Name $SiteName -ErrorAction Stop
            Write-Host "  Started site: $SiteName"
            return
        }
        catch {
            Write-Warn "Start-Website $SiteName attempt $attempt/$maxAttempts failed: $($_.Exception.Message)"
            Ensure-IisServicesRunning
            if ($attempt -eq 3) {
                Write-Host "  Running iisreset..."
                try { & iisreset /noforce 2>$null | Out-Null } catch { }
                Start-Sleep -Seconds 3
            }
            else {
                Start-Sleep -Seconds (2 * $attempt)
            }
        }
    }

    $appcmd = Join-Path $env:SystemRoot "System32\inetsrv\appcmd.exe"
    if (Test-Path $appcmd) {
        Write-Host "  Trying appcmd start site $SiteName..."
        & $appcmd start site /site.name:"$SiteName" | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Started site via appcmd: $SiteName"
            return
        }
    }

    throw "Could not start IIS site '$SiteName'. Check that W3SVC is running (services.msc)."
}

function Invoke-SqlNonQuery {
    param(
        [string]$Server,
        [string]$Query
    )

    $sqlcmd = Get-SqlCmdPath
    if (-not $sqlcmd) {
        Write-Warn "sqlcmd not found. Skipping automated SQL permission setup."
        Write-Warn "In SSMS, grant the app pool login db access: $ApiPoolIdentity"
        return $false
    }

    & $sqlcmd -S $Server -E -b -Q $Query | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "SQL command failed (exit $LASTEXITCODE). Configure permissions manually in SSMS."
        return $false
    }

    return $true
}

function New-ProductionAppSettings {
    param(
        [string]$Path,
        [string]$ConnectionString,
        [string]$Secret,
        [string[]]$CorsOrigins
    )

    $settings = [ordered]@{
        ConnectionStrings = [ordered]@{
            DefaultConnection = $ConnectionString
        }
        Jwt = [ordered]@{
            Secret = $Secret
        }
        Cors = [ordered]@{
            AllowedOrigins = $CorsOrigins
        }
        Logging = [ordered]@{
            LogLevel = [ordered]@{
                Default = "Information"
                "Microsoft.AspNetCore" = "Warning"
                "Microsoft.EntityFrameworkCore.Database.Command" = "Warning"
            }
        }
        AllowedHosts = "*"
    }

    $json = $settings | ConvertTo-Json -Depth 6
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Get-WebConfigSystemWebServerNode {
    param([xml]$Xml)

    $node = $Xml.SelectSingleNode("//*[local-name()='system.webServer']")
    if ($node) {
        return $node
    }

    $configuration = $Xml.SelectSingleNode("//*[local-name()='configuration']")
    if (-not $configuration) {
        $configuration = $Xml.CreateElement("configuration")
        if ($Xml.DocumentElement) {
            [void]$Xml.ReplaceChild($configuration, $Xml.DocumentElement)
        }
        else {
            [void]$Xml.AppendChild($configuration)
        }
    }

    $location = $Xml.SelectSingleNode("//*[local-name()='location']")
    if (-not $location) {
        $location = $Xml.CreateElement("location")
        $location.SetAttribute("path", ".")
        $location.SetAttribute("inheritInChildApplications", "false")
        [void]$configuration.AppendChild($location)
    }

    $systemWebServer = $Xml.CreateElement("system.webServer")
    [void]$location.AppendChild($systemWebServer)
    return $systemWebServer
}

function Update-ApiWebConfig {
    param([string]$WebConfigPath)

    if (-not (Test-Path $WebConfigPath)) {
        Write-Warn "API web.config not found at $WebConfigPath"
        return
    }

    [xml]$xml = Get-Content $WebConfigPath
    $systemWebServer = Get-WebConfigSystemWebServerNode -Xml $xml

    $security = $systemWebServer.SelectSingleNode("*[local-name()='security']")
    if (-not $security) {
        $security = $xml.CreateElement("security")
        [void]$systemWebServer.AppendChild($security)
    }

    $requestFiltering = $security.SelectSingleNode("*[local-name()='requestFiltering']")
    if (-not $requestFiltering) {
        $requestFiltering = $xml.CreateElement("requestFiltering")
        [void]$security.AppendChild($requestFiltering)
    }

    $requestLimits = $requestFiltering.SelectSingleNode("*[local-name()='requestLimits']")
    if (-not $requestLimits) {
        $requestLimits = $xml.CreateElement("requestLimits")
        [void]$requestFiltering.AppendChild($requestLimits)
    }
    $requestLimits.SetAttribute("maxAllowedContentLength", "1073741824")

    $aspNetCore = $systemWebServer.SelectSingleNode("*[local-name()='aspNetCore']")
    if ($aspNetCore) {
        $aspNetCore.SetAttribute("requestTimeout", "00:10:00")
        $aspNetCore.SetAttribute("startupTimeLimit", "300")
        $aspNetCore.SetAttribute("stdoutLogEnabled", "true")
        $aspNetCore.SetAttribute("stdoutLogFile", ".\logs\stdout")
        $aspNetCore.SetAttribute("processesPerApplication", "1")

        $envVars = $aspNetCore.SelectSingleNode("*[local-name()='environmentVariables']")
        if (-not $envVars) {
            $envVars = $xml.CreateElement("environmentVariables")
            [void]$aspNetCore.AppendChild($envVars)
        }

        $existing = @{}
        foreach ($node in $envVars.SelectNodes("*[local-name()='environmentVariable']")) {
            $existing[$node.GetAttribute("name")] = $node
        }

        if (-not $existing.ContainsKey("ASPNETCORE_ENVIRONMENT")) {
            $envNode = $xml.CreateElement("environmentVariable")
            $envNode.SetAttribute("name", "ASPNETCORE_ENVIRONMENT")
            $envNode.SetAttribute("value", "Production")
            [void]$envVars.AppendChild($envNode)
        }
    }

    $xml.Save($WebConfigPath)
}

function New-FrontendWebConfig {
    param([string]$Path, [int]$BackendPort)

    # Do not use serverVariables here - they require machine-level unlock and cause HTTP 500.52.
    # ARR preserveHostHeader=false rewrites the Host header to match the backend URL (127.0.0.1).
    $content = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$BackendPort/api/{R:1}" />
        </rule>
        <rule name="Uploads Proxy" stopProcessing="true">
          <match url="^uploads/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$BackendPort/uploads/{R:1}" />
        </rule>
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".woff" />
      <mimeMap fileExtension=".woff" mimeType="font/woff" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="1073741824" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
"@

    Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Test-CommandAvailable([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Retries = 30,
        [int]$DelaySeconds = 3
    )

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Write-Host "  Attempt $i/$Retries : waiting for $Url ..."
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    return $false
}

# ---------------------------------------------------------------------------
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Invoice Master - IIS Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-IsAdministrator)) {
    Write-Err "Run as Administrator. Use deploy-iis.bat or right-click PowerShell -> Run as administrator."
    exit 1
}

if ($InstallIisFeatures) {
    Write-Step "Enabling IIS Windows features (may take several minutes)..."
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

    foreach ($feature in $features) {
        try {
            Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart -ErrorAction Stop | Out-Null
            Write-Host "  Enabled $feature"
        }
        catch {
            Write-Warn "Could not enable $feature : $($_.Exception.Message)"
        }
    }
}

Write-Step "Checking prerequisites..."

$missing = @()

if (-not (Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Enabled" })) {
    $missing += "IIS is not enabled. Re-run with -InstallIisFeatures or enable IIS in Windows Features."
}

Import-Module WebAdministration -ErrorAction SilentlyContinue

if (-not (Test-Path "$env:SystemRoot\System32\inetsrv\aspnetcorev2.dll") -and
    -not (Get-WebGlobalModule -Name "AspNetCoreModuleV2" -ErrorAction SilentlyContinue)) {
    $missing += ".NET 8 Hosting Bundle missing for IIS. Run: .\install-iis-prerequisites.ps1 (or install Hosting Bundle from https://dotnet.microsoft.com/download/dotnet/8.0 then iisreset)"
}

if (-not (Get-Module WebAdministration)) {
    Import-Module WebAdministration -ErrorAction Stop
}

if (-not (Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue)) {
    $missing += "IIS URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite"
}

if (-not (Get-WebGlobalModule -Name "ApplicationRequestRouting" -ErrorAction SilentlyContinue)) {
    $missing += "IIS ARR (Application Request Routing): https://www.iis.net/downloads/microsoft/application-request-routing"
}

if (-not $SkipBuild) {
    if (-not (Test-CommandAvailable "dotnet")) {
        $missing += ".NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0"
    }
    if (-not (Test-CommandAvailable "npm")) {
        $missing += "Node.js (includes npm): https://nodejs.org/"
    }
    if (-not (Test-Path $ApiProject)) {
        $missing += "API project not found: $ApiProject"
    }
    if (-not (Test-Path $WebProject)) {
        $missing += "React project not found: $WebProject"
    }
}

if ($missing.Count -gt 0) {
    Write-Err "Missing prerequisites:"
    foreach ($item in $missing) {
        Write-Host "  - $item" -ForegroundColor Yellow
    }
    exit 1
}

Write-Ok "Prerequisites look good"

# Enable ARR reverse proxy
Write-Step "Enabling IIS reverse proxy (ARR)..."
if (Enable-ArrProxySettings) {
    Write-Ok "ARR proxy enabled (preserveHostHeader=false)"
}
else {
    Write-Warn "Could not enable ARR proxy automatically."
}

# Build & publish
if (-not $SkipBuild) {
    Write-Step "Stopping IIS sites/app pools so deploy files can be replaced..."
    Stop-IisSitesForPublish

    Write-Step "Publishing .NET API..."
    Remove-DeployFolder -Path $ApiDeployPath
    New-Item -ItemType Directory -Path $ApiDeployPath -Force | Out-Null
    & dotnet publish $ApiProject -c Release -o $ApiDeployPath
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }
    Write-Ok "API published to $ApiDeployPath"

    Write-Step "Building React frontend..."
    Push-Location $WebProject
    try {
        if (Test-Path "node_modules") {
            & npm install
        }
        else {
            & npm install
        }
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    }
    finally {
        Pop-Location
    }

    Remove-DeployFolder -Path $WebDeployPath
    New-Item -ItemType Directory -Path $WebDeployPath -Force | Out-Null
    Copy-Item (Join-Path $WebProject "dist\*") $WebDeployPath -Recurse -Force
    Write-Ok "Frontend built to $WebDeployPath"
}
else {
    Write-Warn "SkipBuild set - using existing files in $DeployRoot"
    if (-not (Test-Path $ApiDeployPath)) { throw "API folder not found: $ApiDeployPath" }
    if (-not (Test-Path $WebDeployPath)) { throw "Web folder not found: $WebDeployPath" }
}

# Folders & config
Write-Step "Configuring deployment files..."

$uploadsPath = Join-Path $ApiDeployPath "wwwroot\uploads\logos"
$backupsPath = Join-Path $ApiDeployPath "wwwroot\backups\shared"
$logsPath = Join-Path $ApiDeployPath "logs"
foreach ($dir in @($uploadsPath, $backupsPath, $logsPath)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

if ([string]::IsNullOrWhiteSpace($JwtSecret)) {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $JwtSecret = [Convert]::ToBase64String($bytes)
}

$connectionString = "Server=$SqlServer;Database=$DatabaseName;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=true"

$computerName = $env:COMPUTERNAME
$corsOrigins = @(
    "http://localhost",
    "http://127.0.0.1",
    "http://$computerName"
)

$lanIp = Get-LanIPv4Address
if ($lanIp) {
    $corsOrigins += "http://$lanIp"
}

if ($AddLocalDomain) {
    $corsOrigins += "http://invoiceapp.local"
}

$corsOrigins = $corsOrigins | Select-Object -Unique

$prodSettingsPath = Join-Path $ApiDeployPath "appsettings.Production.json"
New-ProductionAppSettings -Path $prodSettingsPath -ConnectionString $connectionString -Secret $JwtSecret -CorsOrigins $corsOrigins
Update-ApiWebConfig -WebConfigPath (Join-Path $ApiDeployPath "web.config")
New-FrontendWebConfig -Path (Join-Path $WebDeployPath "web.config") -BackendPort $ApiPort

Write-Ok "Configuration files written"

# IIS sites (create pools first so app pool identity exists for ACL/SQL)
Write-Step "Creating IIS application pools and websites..."

Ensure-IisServicesRunning

Stop-IfExists -SiteName $ApiSiteName -AppPoolName $ApiAppPool
Stop-IfExists -SiteName $WebSiteName -AppPoolName $WebAppPool

New-WebAppPool -Name $ApiAppPool | Out-Null
Set-ItemProperty "IIS:\AppPools\$ApiAppPool" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\$ApiAppPool" -Name startMode -Value "AlwaysRunning"

New-WebAppPool -Name $WebAppPool | Out-Null
Set-ItemProperty "IIS:\AppPools\$WebAppPool" -Name managedRuntimeVersion -Value ""

New-Website -Name $ApiSiteName -PhysicalPath $ApiDeployPath -ApplicationPool $ApiAppPool -Port $ApiPort | Out-Null
Set-ApiSiteLocalhostBinding -SiteName $ApiSiteName -Port $ApiPort

New-Website -Name $WebSiteName -PhysicalPath $WebDeployPath -ApplicationPool $WebAppPool -Port $WebPort | Out-Null

Start-IisAppPoolSafe -AppPoolName $ApiAppPool
Start-IisAppPoolSafe -AppPoolName $WebAppPool
Start-Sleep -Seconds 2

Write-Ok "IIS sites created"

# Permissions (after app pool exists)
Write-Step "Setting folder permissions..."

$sqlServiceAccounts = @(
    "NT SERVICE\MSSQLSERVER",
    "NT SERVICE\MSSQL`$SQLEXPRESS",
    "NT Service\MSSQLSERVER",
    "NT Service\MSSQL`$SQLEXPRESS"
)

Grant-FolderAcl -Path (Join-Path $ApiDeployPath "wwwroot") -Accounts @($ApiPoolIdentity, "IIS_IUSRS", "NETWORK SERVICE") -Rights "M"
Grant-FolderAcl -Path $backupsPath -Accounts @($ApiPoolIdentity, "IIS_IUSRS") + $sqlServiceAccounts -Rights "M"
Grant-FolderAcl -Path $logsPath -Accounts @($ApiPoolIdentity, "IIS_IUSRS") -Rights "M"

Write-Ok "Folder permissions applied"

# SQL permissions
Write-Step "Configuring SQL Server permissions for $ApiPoolIdentity ..."

$escapedPool = $ApiPoolIdentity.Replace("'", "''")
$sqlSetup = @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$escapedPool')
    CREATE LOGIN [$ApiPoolIdentity] FROM WINDOWS;
IF NOT EXISTS (
    SELECT 1
    FROM sys.server_role_members rm
    INNER JOIN sys.server_principals role_p ON rm.role_principal_id = role_p.principal_id
    INNER JOIN sys.server_principals member_p ON rm.member_principal_id = member_p.principal_id
    WHERE role_p.name = N'dbcreator' AND member_p.name = N'$escapedPool'
)
    ALTER SERVER ROLE dbcreator ADD MEMBER [$ApiPoolIdentity];
IF DB_ID(N'$DatabaseName') IS NOT NULL
BEGIN
    USE [$DatabaseName];
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$escapedPool')
        CREATE USER [$ApiPoolIdentity] FOR LOGIN [$ApiPoolIdentity];
    IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members drm
        INNER JOIN sys.database_principals role_p ON drm.role_principal_id = role_p.principal_id
        INNER JOIN sys.database_principals member_p ON drm.member_principal_id = member_p.principal_id
        WHERE role_p.name = N'db_owner' AND member_p.name = N'$escapedPool'
    )
        ALTER ROLE db_owner ADD MEMBER [$ApiPoolIdentity];
END
"@

if (Invoke-SqlNonQuery -Server $SqlServer -Query $sqlSetup) {
    Write-Ok "SQL permissions configured (API will create DB on first start if missing)"
}

Write-Step "Starting IIS sites..."
Ensure-IisServicesRunning
Start-IisAppPoolSafe -AppPoolName $ApiAppPool
Start-IisAppPoolSafe -AppPoolName $WebAppPool
Start-IisSiteSafe -SiteName $ApiSiteName
Start-IisSiteSafe -SiteName $WebSiteName

Write-Ok "IIS sites started"

# Firewall
Write-Step "Configuring Windows Firewall..."
try {
    $ruleName = "InvoiceApp Web ($WebPort)"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $WebPort | Out-Null
    }
    Write-Ok "Firewall rule for TCP $WebPort"
}
catch {
    Write-Warn "Could not create firewall rule: $($_.Exception.Message)"
}

# Optional hosts entry
if ($AddLocalDomain) {
    Write-Step "Adding invoiceapp.local to hosts file..."
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $hostsContent = Get-Content $hostsPath -ErrorAction Stop
    if (-not ($hostsContent -match "invoiceapp\.local")) {
        Add-Content -Path $hostsPath -Value "`n# Invoice Master IIS`n127.0.0.1`tinvoiceapp.local"
        Write-Ok "Added invoiceapp.local"
    }
    else {
        Write-Ok "invoiceapp.local already in hosts file"
    }
}

# Health checks
Write-Step "Waiting for API to start (database may be created on first run)..."
$apiHealthUrl = "http://127.0.0.1:${ApiPort}/health"
if (Wait-ForUrl -Url $apiHealthUrl -Retries 40 -DelaySeconds 5) {
    Write-Ok "API health check passed: $apiHealthUrl"
}
else {
    Write-Warn "API health check did not succeed yet. Check logs in $logsPath"
    Write-Warn "Enable stdout logs in Api\web.config if needed."
}

$webUrl = if ($WebPort -eq 80) { "http://localhost" } else { "http://localhost:$WebPort" }
if (Wait-ForUrl -Url $webUrl -Retries 10 -DelaySeconds 2) {
    Write-Ok "Frontend reachable: $webUrl"
}
else {
    Write-Warn "Frontend not responding yet at $webUrl"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Deployment Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "  App:      $webUrl"
Write-Host "  API:      http://127.0.0.1:${ApiPort}/health (internal)"
if ($AddLocalDomain) {
    Write-Host "  Domain:   http://invoiceapp.local$(if ($WebPort -ne 80) { ":$WebPort" })"
}
Write-Host ""
Write-Host "Paths:" -ForegroundColor Yellow
Write-Host "  API:      $ApiDeployPath"
Write-Host "  Web:      $WebDeployPath"
Write-Host "  SQL:      $SqlServer / $DatabaseName"
Write-Host ""
Write-Host "IIS:" -ForegroundColor Yellow
Write-Host "  Sites:    $WebSiteName (port $WebPort), $ApiSiteName (127.0.0.1:$ApiPort)"
Write-Host "  Pools:    $WebAppPool, $ApiAppPool"
Write-Host ""
Write-Host "JWT secret saved in:" -ForegroundColor Yellow
Write-Host "  $prodSettingsPath"
Write-Host ""
Write-Host "Redeploy after code changes:" -ForegroundColor Yellow
Write-Host "  deploy-iis.bat"
Write-Host "  or: .\deploy-iis.ps1 -SqlServer '$SqlServer'"
Write-Host ""

if (-not $NoPause) {
    Write-Host "Press Enter to exit..."
    [void][System.Console]::ReadLine()
}
