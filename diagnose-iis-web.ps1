#Requires -Version 5.1
<#
.SYNOPSIS
    Diagnose blank page / static file issues for Invoice Master IIS frontend.

.EXAMPLE
    .\diagnose-iis-web.ps1
    .\diagnose-iis-web.ps1 -DeployRoot "C:\inetpub\InvoiceApp" -WebPort 80
#>

[CmdletBinding()]
param(
    [string]$DeployRoot = "C:\inetpub\InvoiceApp",
    [string]$WebSiteName = "InvoiceApp-Web",
    [int]$WebPort = 80,
    [int]$ApiPort = 5001
)

$WebPath = Join-Path $DeployRoot "Web"
$WebConfigPath = Join-Path $WebPath "web.config"
$IndexPath = Join-Path $WebPath "index.html"
$AssetsPath = Join-Path $WebPath "assets"
$BaseUrl = if ($WebPort -eq 80) { "http://localhost" } else { "http://localhost:$WebPort" }

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

$issues = 0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Invoice Master - IIS Web Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Web path: $WebPath" -ForegroundColor Gray
Write-Host "  URL:      $BaseUrl" -ForegroundColor Gray

Write-Step "Checking deployed frontend files..."
if (-not (Test-Path $WebPath)) {
    Write-Err "Web folder not found: $WebPath"
    exit 1
}

if (-not (Test-Path $IndexPath)) {
    Write-Err "Missing index.html"
    $issues++
}
else {
    $indexHtml = Get-Content $IndexPath -Raw
    if ($indexHtml -match '/src/main\.tsx') {
        Write-Err "index.html is the DEV template (references /src/main.tsx). Re-run deploy-iis.ps1 to build and copy dist/."
        $issues++
    }
    elseif ($indexHtml -notmatch '/assets/.*\.js') {
        Write-Err "index.html does not reference /assets/*.js production bundles."
        $issues++
    }
    else {
        Write-Ok "index.html looks like a production build"
        if ($indexHtml -match 'src="([^"]+\.js)"') {
            Write-Host "  Main bundle: $($Matches[1])" -ForegroundColor Gray
        }
    }
}

$jsFiles = @(Get-ChildItem $AssetsPath -Filter "*.js" -ErrorAction SilentlyContinue)
if ($jsFiles.Count -eq 0) {
    Write-Err "No JavaScript files in $AssetsPath"
    $issues++
}
else {
    Write-Ok "Found $($jsFiles.Count) JS file(s) in assets/"
}

if (-not (Test-Path $WebConfigPath)) {
    Write-Err "Missing web.config in Web folder"
    $issues++
}
else {
    $wc = Get-Content $WebConfigPath -Raw
    if ($wc -notmatch 'application/javascript') {
        Write-Warn "web.config may be missing .js MIME type (can cause blank page)"
        $issues++
    }
    else {
        Write-Ok "web.config includes JavaScript MIME map"
    }
}

Write-Step "Checking IIS sites and port $WebPort bindings..."
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Warn "WebAdministration module not available - run as Administrator"
}
else {
    $targetBinding = "*:${WebPort}:"
    $sitesOnPort = @()
    foreach ($site in @(Get-Website)) {
        foreach ($binding in @(Get-WebBinding -Name $site.Name -Protocol "http" -ErrorAction SilentlyContinue)) {
            if ($binding.bindingInformation -eq $targetBinding) {
                $sitesOnPort += [pscustomobject]@{
                    Site   = $site.Name
                    State  = $site.State
                    Path   = $site.physicalPath
                    Binding = $binding.bindingInformation
                }
            }
        }
    }

    if ($sitesOnPort.Count -eq 0) {
        Write-Err "No IIS site is bound to $targetBinding"
        $issues++
    }
    else {
        foreach ($entry in $sitesOnPort) {
            $marker = if ($entry.Site -eq $WebSiteName) { "[OK]" } else { "[WARN]" }
            $color = if ($entry.Site -eq $WebSiteName) { "Green" } else { "Yellow" }
            Write-Host "$marker Site '$($entry.Site)' ($($entry.State)) -> $($entry.Path)" -ForegroundColor $color
            if ($entry.Site -ne $WebSiteName -and $entry.State -eq "Started") {
                Write-Warn "Another site is also listening on port $WebPort. IIS may serve the wrong folder for http://localhost"
                $issues++
            }
        }
    }

    $appSite = Get-Website -Name $WebSiteName -ErrorAction SilentlyContinue
    if (-not $appSite) {
        Write-Err "Site '$WebSiteName' not found. Re-run deploy-iis.ps1"
        $issues++
    }
    elseif ($appSite.physicalPath -ne $WebPath) {
        Write-Warn "Site physical path is '$($appSite.physicalPath)' but deploy path is '$WebPath'"
        $issues++
    }
    else {
        Write-Ok "Site '$WebSiteName' points to deploy Web folder"
    }
}

Write-Step "Testing HTTP responses from $BaseUrl ..."
Write-Host "  Note: API health at http://127.0.0.1:$ApiPort/health is separate from the web UI." -ForegroundColor Gray
try {
    $indexResponse = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 15
    Write-Ok "GET / returned $($indexResponse.StatusCode)"
    if ($indexResponse.Content -match '/src/main\.tsx') {
        Write-Err "GET / returned dev index.html (not production build)"
        $issues++
    }
}
catch {
    Write-Err "GET / failed: $($_.Exception.Message)"
    $issues++
}

if (Test-Path $IndexPath) {
    $indexHtml = Get-Content $IndexPath -Raw
    if ($indexHtml -match 'src="([^"]+\.js)"') {
        $jsUrl = $Matches[1]
        if ($jsUrl -notmatch '^https?://') {
            $jsUrl = "$BaseUrl$jsUrl"
        }
        try {
            $js = Invoke-WebRequest -Uri $jsUrl -UseBasicParsing -TimeoutSec 15
            $ctype = $js.Headers['Content-Type']
            Write-Ok "GET $jsUrl returned $($js.StatusCode) ($ctype)"
            if ($ctype -and $ctype -notmatch 'javascript') {
                Write-Err "JavaScript served with wrong MIME type: $ctype (browser will not run module scripts)"
                $issues++
            }
            if ($js.Content -match '^\s*<(!doctype|html)') {
                Write-Err "JS URL returned HTML instead of JavaScript (likely 404 rewritten to index.html)"
                $issues++
            }
        }
        catch {
            Write-Err "GET $jsUrl failed: $($_.Exception.Message)"
            $issues++
        }
    }
}

try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 15
    Write-Ok "GET /api/health returned $($health.StatusCode)"
}
catch {
    Write-Warn "GET /api/health failed: $($_.Exception.Message)"
}

Write-Step "Summary"
if ($issues -eq 0) {
    Write-Ok "No obvious web deployment issues found."
    Write-Host "If the page is still blank, open DevTools (F12) -> Console for JavaScript errors." -ForegroundColor Gray
}
else {
    Write-Err "$issues issue(s) found."
    Write-Host ""
    Write-Host "Quick fix (run as Administrator):" -ForegroundColor Yellow
    Write-Host "  .\fix-iis-web.ps1 -DeployRoot `"$DeployRoot`"" -ForegroundColor White
    Write-Host "  .\deploy-iis.ps1 -SkipBuild -NoPause" -ForegroundColor White
    exit 1
}
