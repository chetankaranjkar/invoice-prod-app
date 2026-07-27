#Requires -Version 5.1
<#
.SYNOPSIS
    Fix IIS HTTP 500.52 URL Rewrite errors for Invoice Master frontend.

.EXAMPLE
    .\fix-iis-rewrite.ps1
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [int]$ApiPort = 5001
)

$WebConfigPath = Join-Path $DeployRoot "Web\web.config"

function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }

$content = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$ApiPort/api/{R:1}" />
        </rule>
        <rule name="Uploads Proxy" stopProcessing="true">
          <match url="^uploads/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$ApiPort/uploads/{R:1}" />
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

if (-not (Test-Path (Split-Path $WebConfigPath -Parent))) {
    Write-Host "[ERROR] Web folder not found: $(Split-Path $WebConfigPath -Parent)" -ForegroundColor Red
    exit 1
}

Set-Content -Path $WebConfigPath -Value $content -Encoding UTF8
Write-Ok "Rewrote $WebConfigPath (removed serverVariables that cause 500.52)"

Import-Module WebAdministration -ErrorAction SilentlyContinue
try {
    Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
    Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "preserveHostHeader" -Value "False"
    Write-Ok "ARR proxy: preserveHostHeader=false"
}
catch {
    Write-Host "[WARN] Could not set ARR proxy settings: $($_.Exception.Message)" -ForegroundColor Yellow
}

try { & iisreset | Out-Null; Write-Ok "IIS restarted" } catch { }

Write-Host ""
Write-Host "Open http://localhost and test again." -ForegroundColor Green
