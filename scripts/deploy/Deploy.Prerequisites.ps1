# Phase 1: Prerequisite validation

function Test-DeployAdministrator {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DeployPowerShellVersion {
    $min = [version]"5.1"
    $current = $PSVersionTable.PSVersion
    return @{
        Passed = ($current -ge $min)
        Detail = "PowerShell $current (minimum $min required)"
    }
}

function Test-IIS {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -ErrorAction SilentlyContinue
    $enabled = $feature -and $feature.State -eq "Enabled"
    return @{
        Passed = $enabled
        Detail = if ($enabled) { "IIS Web Server role is enabled" } else { "IIS Web Server role is not enabled. Re-run with -InstallIisFeatures" }
    }
}

function Test-IisManagementTools {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName IIS-ManagementConsole -ErrorAction SilentlyContinue
    $enabled = $feature -and $feature.State -eq "Enabled"
    $moduleOk = $null -ne (Get-Module -ListAvailable -Name WebAdministration)
    $passed = $enabled -or $moduleOk
    return @{
        Passed = $passed
        Detail = if ($passed) { "IIS Management Tools available" } else { "Install IIS Management Console" }
    }
}

function Test-AspNetCoreHostingBundle {
    $dll = Join-Path $env:SystemRoot "System32\inetsrv\aspnetcorev2.dll"
    $module = $null
    try {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
        $module = Get-WebGlobalModule -Name "AspNetCoreModuleV2" -ErrorAction SilentlyContinue
    }
    catch { }

    $passed = (Test-Path $dll) -or $null -ne $module
    return @{
        Passed = $passed
        Detail = if ($passed) { "ASP.NET Core Hosting Bundle (ANCM v2) installed" } else { "Install .NET 8 Hosting Bundle from https://dotnet.microsoft.com/download/dotnet/8.0" }
    }
}

function Test-UrlRewriteModule {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $mod = Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue
    return @{
        Passed = ($null -ne $mod)
        Detail = if ($mod) { "URL Rewrite Module installed" } else { "Install from https://www.iis.net/downloads/microsoft/url-rewrite" }
    }
}

function Test-ArrModule {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $mod = Get-WebGlobalModule -Name "ApplicationRequestRouting" -ErrorAction SilentlyContinue
    return @{
        Passed = ($null -ne $mod)
        Detail = if ($mod) { "Application Request Routing installed" } else { "Install ARR from https://www.iis.net/downloads/microsoft/application-request-routing" }
    }
}

function Test-DotNetRuntime {
    $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnet) {
        return @{ Passed = $false; Detail = ".NET SDK/runtime not found on PATH" }
    }

    $runtimes = & dotnet --list-runtimes 2>&1
    $hasAspNet8 = $runtimes | Where-Object { $_ -match 'Microsoft\.AspNetCore\.App 8\.' }
    $hasNet8 = $runtimes | Where-Object { $_ -match 'Microsoft\.NETCore\.App 8\.' }
    $passed = $hasAspNet8 -or $hasNet8
    return @{
        Passed = $passed
        Detail = if ($passed) { ".NET 8 runtime detected" } else { "Install .NET 8 runtime/SDK" }
    }
}

function Test-SqlServerInstalled {
    $services = @(Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue)
    $localDb = Test-Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server Local DB\Installed Versions"
    $registry = Test-Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
    $passed = ($services.Count -gt 0) -or $localDb -or $registry
    $detail = if ($services.Count -gt 0) {
        "Services: $($services.Name -join ', ')"
    }
    elseif ($localDb) {
        "LocalDB installed"
    }
    elseif ($registry) {
        "SQL instances found in registry"
    }
    else {
        "No SQL Server installation detected"
    }
    return @{ Passed = $passed; Detail = $detail }
}

function Test-SqlServerRunning {
    $running = @(Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" })
    $passed = $running.Count -gt 0
    return @{
        Passed = $passed
        Detail = if ($passed) { "Running: $($running.Name -join ', ')" } else { "No MSSQL* service is running. Start SQL Server service." }
    }
}

function Test-SqlCmdInstalled {
    $path = Get-SqlCmdPath
    return @{
        Passed = ($null -ne $path)
        Detail = if ($path) { "sqlcmd: $path" } else { "sqlcmd not found. Install SSMS or SQL Server Command Line Utilities." }
    }
}

function Test-OdbcDriver {
    $drivers = @()
    try {
        $drivers = @(Get-OdbcDriver -Platform "64-bit" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
    }
    catch { }

    if ($drivers.Count -eq 0) {
        $odbcKey = "HKLM:\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers"
        if (Test-Path $odbcKey) {
            $drivers = @((Get-ItemProperty $odbcKey).PSObject.Properties.Name |
                Where-Object { $_ -notmatch '^PS' })
        }
    }

    $sqlDriver = $drivers | Where-Object { $_ -match 'SQL Server|ODBC Driver (1[78]|13) for SQL Server' } | Select-Object -First 1
    return @{
        Passed = ($null -ne $sqlDriver)
        Detail = if ($sqlDriver) { "ODBC driver: $sqlDriver" } else { "Install ODBC Driver 17/18 for SQL Server" }
    }
}

function Test-BuildPrerequisites {
    param([hashtable]$Config)

    $results = @()
    if (-not $Config.SkipBuild) {
        $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
        $results += @{
            Name   = ".NET SDK (build)"
            Passed = ($null -ne $dotnet)
            Detail = if ($dotnet) { $dotnet.Source } else { "Required for dotnet publish" }
        }
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        $results += @{
            Name   = "Node.js / npm (build)"
            Passed = ($null -ne $npm)
            Detail = if ($npm) { $npm.Source } else { "Required for npm build" }
        }
        $results += @{
            Name   = "API project"
            Passed = (Test-Path $Config.ApiProject)
            Detail = $Config.ApiProject
        }
        $results += @{
            Name   = "React project"
            Passed = (Test-Path $Config.WebProject)
            Detail = $Config.WebProject
        }
    }
    return $results
}

function Install-IisFeaturesIfRequested {
    param([switch]$InstallIisFeatures)

    if (-not $InstallIisFeatures) { return }

    Write-DeployLog "Installing IIS Windows features..."
    $features = @(
        "IIS-WebServerRole", "IIS-WebServer", "IIS-CommonHttpFeatures", "IIS-StaticContent",
        "IIS-DefaultDocument", "IIS-HttpErrors", "IIS-ApplicationDevelopment",
        "IIS-NetFxExtensibility45", "IIS-ASPNET45", "IIS-HealthAndDiagnostics",
        "IIS-HttpLogging", "IIS-Security", "IIS-RequestFiltering", "IIS-Performance",
        "IIS-WebServerManagementTools", "IIS-ManagementConsole", "IIS-WebSockets"
    )

    foreach ($feature in $features) {
        try {
            Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart -ErrorAction Stop | Out-Null
            Write-DeployLog "Enabled feature: $feature"
        }
        catch {
            Write-Warn "Could not enable ${feature}: $($_.Exception.Message)"
        }
    }
}

function Invoke-PrerequisiteValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    Install-IisFeaturesIfRequested -InstallIisFeatures:$Config.InstallIisFeatures

    Import-Module WebAdministration -ErrorAction SilentlyContinue

    $checks = @(
        @{ Name = "Administrator privileges"; Result = @{ Passed = (Test-DeployAdministrator); Detail = "Must run as Administrator" } }
        @{ Name = "PowerShell version"; Result = (Test-DeployPowerShellVersion) }
        @{ Name = "IIS installed"; Result = (Test-IIS) }
        @{ Name = "IIS Management Tools"; Result = (Test-IisManagementTools) }
        @{ Name = "ASP.NET Core Hosting Bundle"; Result = (Test-AspNetCoreHostingBundle) }
        @{ Name = "URL Rewrite Module"; Result = (Test-UrlRewriteModule) }
        @{ Name = "Application Request Routing"; Result = (Test-ArrModule) }
        @{ Name = ".NET 8 Runtime"; Result = (Test-DotNetRuntime) }
        @{ Name = "SQL Server installed"; Result = (Test-SqlServerInstalled) }
        @{ Name = "SQL Server running"; Result = (Test-SqlServerRunning) }
        @{ Name = "sqlcmd"; Result = (Test-SqlCmdInstalled) }
        @{ Name = "ODBC Driver"; Result = (Test-OdbcDriver) }
    )

    $buildChecks = Test-BuildPrerequisites -Config $Config
    foreach ($bc in $buildChecks) {
        $checks += @{ Name = $bc.Name; Result = @{ Passed = $bc.Passed; Detail = $bc.Detail } }
    }

    $report = foreach ($c in $checks) {
        [pscustomobject]@{
            Name   = $c.Name
            Passed = $c.Result.Passed
            Detail = $c.Result.Detail
        }
    }

    Write-ValidationReport -Results $report

    $failed = $report | Where-Object { -not $_.Passed }
    if ($failed) {
        $msg = "Prerequisite validation failed: $($failed.Name -join ', ')"
        Write-ErrorLog $msg
        throw $msg
    }

    $ctx = Get-DeployContext
    $ctx.SqlCmdPath = Get-SqlCmdPath
    Set-DeploySummary -Key Prerequisites -Value $true
    Write-Ok "All prerequisites passed"
    return $report
}
