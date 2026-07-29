# Application configuration files

function Get-LanIPv4Address {
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
    Write-DeployLog "Wrote appsettings.Production.json"
}

function Get-WebConfigSystemWebServerNode {
    param([xml]$Xml)

    $node = $Xml.SelectSingleNode("//*[local-name()='system.webServer']")
    if ($node) { return $node }

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
    Write-DeployLog "Updated API web.config"
}

function New-FrontendWebConfig {
    param(
        [string]$Path,
        [int]$BackendPort
    )

    $content = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <defaultDocument enabled="true">
      <files>
        <clear />
        <add value="index.html" />
      </files>
    </defaultDocument>
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
      <remove fileExtension=".js" />
      <mimeMap fileExtension=".js" mimeType="application/javascript" />
      <remove fileExtension=".mjs" />
      <mimeMap fileExtension=".mjs" mimeType="application/javascript" />
      <remove fileExtension=".css" />
      <mimeMap fileExtension=".css" mimeType="text/css" />
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
    Write-DeployLog "Wrote frontend web.config"
}

function Invoke-ApplicationConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config,

        [Parameter(Mandatory)]
        [string]$SqlServer,

        [string]$JwtSecret
    )

    $uploadsPath = Join-Path $Config.ApiDeployPath "wwwroot\uploads\logos"
    $backupsPath = Join-Path $Config.ApiDeployPath "wwwroot\backups\shared"
    $logsPath    = Join-Path $Config.ApiDeployPath "logs"

    foreach ($dir in @($uploadsPath, $backupsPath, $logsPath)) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }

    $Config.BackupsPath = $backupsPath
    $Config.LogsPath    = $logsPath

    if ([string]::IsNullOrWhiteSpace($JwtSecret)) {
        $bytes = New-Object byte[] 48
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $JwtSecret = [Convert]::ToBase64String($bytes)
    }

    $connectionString = New-SqlConnectionString -Server $SqlServer -Database $Config.DatabaseName

    $corsOrigins = @(
        "http://localhost",
        "http://127.0.0.1",
        "http://$($env:COMPUTERNAME)"
    )
    $lanIp = Get-LanIPv4Address
    if ($lanIp) { $corsOrigins += "http://$lanIp" }
    if ($Config.AddLocalDomain) { $corsOrigins += "http://invoiceapp.local" }
    $corsOrigins = $corsOrigins | Select-Object -Unique

    $prodSettingsPath = Join-Path $Config.ApiDeployPath "appsettings.Production.json"
    New-ProductionAppSettings -Path $prodSettingsPath -ConnectionString $connectionString `
        -Secret $JwtSecret -CorsOrigins $corsOrigins

    Update-ApiWebConfig -WebConfigPath (Join-Path $Config.ApiDeployPath "web.config")
    New-FrontendWebConfig -Path (Join-Path $Config.WebDeployPath "web.config") -BackendPort $Config.ApiPort

    $Config.ProdSettingsPath = $prodSettingsPath
    $Config.JwtSecret = $JwtSecret

    Set-DeploySummary -Key Configuration -Value $true
    Write-Ok "Configuration files written"
}

function Invoke-FirewallAndHosts {
    param([hashtable]$Config)

    try {
        $ruleName = "InvoiceApp Web ($($Config.WebPort))"
        if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Config.WebPort | Out-Null
            Write-Ok "Firewall rule for TCP $($Config.WebPort)"
        }
    }
    catch {
        Write-Warn "Could not create firewall rule: $($_.Exception.Message)"
    }

    if ($Config.AddLocalDomain) {
        $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
        $hostsContent = Get-Content $hostsPath -ErrorAction Stop
        if (-not ($hostsContent -match "invoiceapp\.local")) {
            Add-Content -Path $hostsPath -Value "`n# Invoice Master IIS`n127.0.0.1`tinvoiceapp.local"
            Write-Ok "Added invoiceapp.local to hosts file"
        }
    }
}
