# Build and publish application artifacts

function Invoke-NpmCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [Parameter(Mandatory)]
        [string]$WorkingDirectory
    )

    $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $npmCmd) {
        $npmCmd = Join-Path $env:ProgramFiles "nodejs\npm.cmd"
    }
    if (-not (Test-Path $npmCmd)) {
        throw "npm.cmd not found. Install Node.js from https://nodejs.org/"
    }

    # Run npm via Process so stderr warnings (e.g. npm 11 allow-scripts) never become
    # PowerShell NativeCommandError records that abort deployment.
    $argString = ($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }) -join ' '

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $npmCmd
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.Arguments = $argString
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    $text = (($stdout + "`n" + $stderr).Trim())

    Write-DeployLog "npm $($Arguments -join ' ')`n$text"

    if ($exitCode -ne 0) {
        throw "npm $($Arguments -join ' ') failed (exit $exitCode):`n$text"
    }

    if ($text -match 'allow-scripts') {
        Write-Warn "npm allow-scripts notice (non-fatal). See Deployment.log for details."
    }

    return $text
}

function Remove-DeployFolder {
    param(
        [string]$Path,
        [scriptblock]$OnLocked
    )

    if (-not (Test-Path $Path)) { return }

    $maxAttempts = 8
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            Remove-Item $Path -Recurse -Force -ErrorAction Stop
            Write-DeployLog "Removed folder: $Path"
            return
        }
        catch {
            if ($attempt -eq $maxAttempts) {
                throw "Could not remove '$Path' (files locked). $($_.Exception.Message)"
            }
            Write-Warn "Folder locked (attempt $attempt/$maxAttempts). Retrying..."
            if ($OnLocked) { & $OnLocked }
            Start-Sleep -Seconds (2 * $attempt)
        }
    }
}

function Invoke-ApplicationBuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    if ($Config.SkipBuild) {
        Write-Warn "SkipBuild set - using existing files in $($Config.DeployRoot)"
        if (-not (Test-Path $Config.ApiDeployPath)) { throw "API folder not found: $($Config.ApiDeployPath)" }
        if (-not (Test-Path $Config.WebDeployPath)) { throw "Web folder not found: $($Config.WebDeployPath)" }
        Set-DeploySummary -Key Build -Value $true
        return
    }

    $stopSites = {
        Stop-IisSitesForPublish -SiteNames @($Config.ApiSiteName, $Config.WebSiteName) `
            -AppPoolNames @($Config.ApiAppPool, $Config.WebAppPool)
    }

    Write-DeployLog "Stopping IIS for publish..."
    & $stopSites

    Write-DeployLog "Publishing API: $($Config.ApiProject)"
    Remove-DeployFolder -Path $Config.ApiDeployPath -OnLocked $stopSites
    New-Item -ItemType Directory -Path $Config.ApiDeployPath -Force | Out-Null

    $publishOutput = & dotnet publish $Config.ApiProject -c Release -o $Config.ApiDeployPath 2>&1
    Write-DeployLog ($publishOutput -join "`n")
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish failed (exit $LASTEXITCODE):`n$($publishOutput -join "`n")"
    }
    Write-Ok "API published to $($Config.ApiDeployPath)"

    Write-DeployLog "Building React frontend..."
    # npm 11+: approve install scripts in package.json (CLI --allow-scripts is not allowed for project installs)
    try {
        Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("approve-scripts", "--all")
        Write-Ok "npm install scripts approved in package.json"
    }
    catch {
        Write-Warn "npm approve-scripts --all: $($_.Exception.Message)"
    }

    Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("install", "--no-fund", "--no-audit")
    Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("run", "build")

    Remove-DeployFolder -Path $Config.WebDeployPath -OnLocked $stopSites
    New-Item -ItemType Directory -Path $Config.WebDeployPath -Force | Out-Null
    Copy-Item (Join-Path $Config.WebProject "dist\*") $Config.WebDeployPath -Recurse -Force

    $indexPath = Join-Path $Config.WebDeployPath "index.html"
    if (-not (Test-Path $indexPath)) {
        throw "Frontend deploy missing index.html at $indexPath"
    }
    $indexHtml = Get-Content $indexPath -Raw
    if ($indexHtml -match '/src/main\.tsx') {
        throw "Dev index.html was deployed instead of production build. Run 'npm run build' in invoice-app."
    }
    if ($indexHtml -notmatch '/assets/.*\.js') {
        throw "Production index.html does not reference built /assets/*.js bundles."
    }
    $assetFiles = @(Get-ChildItem (Join-Path $Config.WebDeployPath "assets") -Filter "*.js" -ErrorAction SilentlyContinue)
    if ($assetFiles.Count -eq 0) {
        throw "Frontend assets folder is empty. Rebuild the React app."
    }

    Write-Ok "Frontend built to $($Config.WebDeployPath)"

    Set-DeploySummary -Key Build -Value $true
}

function Test-DeployedWebFrontend {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config,

        [switch]$ThrowOnFailure
    )

    $issues = New-Object System.Collections.Generic.List[string]
    $webPath = $Config.WebDeployPath
    $indexPath = Join-Path $webPath "index.html"
    $assetsPath = Join-Path $webPath "assets"
    $webUrl = if ($Config.WebPort -eq 80) { "http://localhost" } else { "http://localhost:$($Config.WebPort)" }

    if (-not (Test-Path $indexPath)) {
        $issues.Add("Missing index.html at $indexPath")
    }
    else {
        $indexHtml = Get-Content $indexPath -Raw
        if ($indexHtml -match '/src/main\.tsx') {
            $issues.Add("index.html is the DEV template (references /src/main.tsx). Run: .\rebuild-web.ps1")
        }
        elseif ($indexHtml -notmatch '/assets/.*\.js') {
            $issues.Add("index.html does not reference built /assets/*.js bundles")
        }
    }

    $jsFiles = @(Get-ChildItem $assetsPath -Filter "*.js" -ErrorAction SilentlyContinue)
    if ($jsFiles.Count -eq 0) {
        $issues.Add("No JavaScript files in $assetsPath")
    }

    if (-not (Test-Path (Join-Path $webPath "web.config"))) {
        $issues.Add("Missing web.config in Web folder")
    }

    try {
        $indexResponse = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 15
        if ($indexResponse.Content -match '/src/main\.tsx') {
            $issues.Add("http://localhost is serving dev index.html (wrong IIS site or stale files)")
        }
        elseif ((Test-Path $indexPath) -and ($indexResponse.Content -notmatch '/assets/.*\.js')) {
            $diskHtml = Get-Content $indexPath -Raw
            if ($diskHtml -match '/assets/.*\.js') {
                $issues.Add("Disk has production index.html but $webUrl serves different content (IIS site binding conflict - run .\fix-iis-web.ps1)")
            }
        }
    }
    catch {
        $issues.Add("Could not reach $webUrl : $($_.Exception.Message)")
    }

    if (Test-Path $indexPath) {
        $indexHtml = Get-Content $indexPath -Raw
        if ($indexHtml -match 'src="([^"]+\.js)"') {
            $jsPath = $Matches[1]
            $jsUrl = if ($jsPath -match '^https?://') { $jsPath } else { "$webUrl$jsPath" }
            try {
                $js = Invoke-WebRequest -Uri $jsUrl -UseBasicParsing -TimeoutSec 15
                $ctype = $js.Headers['Content-Type']
                if ($ctype -and $ctype -notmatch 'javascript') {
                    $issues.Add("JavaScript bundle has wrong MIME type: $ctype")
                }
                if ($js.Content -match '^\s*<(!doctype|html)') {
                    $issues.Add("JavaScript URL returned HTML (assets missing or SPA rewrite intercepting /assets)")
                }
            }
            catch {
                $issues.Add("Could not download JS bundle $jsUrl : $($_.Exception.Message)")
            }
        }
    }

    if ($issues.Count -eq 0) {
        Write-Ok "Frontend deployment validated ($webUrl)"
        return $true
    }

    foreach ($issue in $issues) {
        Write-Warn "Frontend: $issue"
    }

    if ($ThrowOnFailure) {
        $detail = ($issues | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
        throw "Frontend deployment validation failed:`n$detail`n`nFix: .\rebuild-web.ps1 then .\fix-iis-web.ps1 (as Administrator)"
    }

    return $false
}

function Invoke-WebFrontendRebuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    if (-not (Test-Path $Config.WebProject)) {
        throw "Frontend project not found: $($Config.WebProject)"
    }

    $stopSites = {
        Stop-IisSitesForPublish -SiteNames @($Config.ApiSiteName, $Config.WebSiteName) `
            -AppPoolNames @($Config.ApiAppPool, $Config.WebAppPool)
    }

    Write-DeployLog "Rebuilding React frontend..."
    & $stopSites

    try {
        Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("approve-scripts", "--all")
    }
    catch {
        Write-Warn "npm approve-scripts --all: $($_.Exception.Message)"
    }

    Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("install", "--no-fund", "--no-audit")
    Invoke-NpmCommand -WorkingDirectory $Config.WebProject -Arguments @("run", "build")

    Remove-DeployFolder -Path $Config.WebDeployPath -OnLocked $stopSites
    New-Item -ItemType Directory -Path $Config.WebDeployPath -Force | Out-Null
    Copy-Item (Join-Path $Config.WebProject "dist\*") $Config.WebDeployPath -Recurse -Force

    $indexPath = Join-Path $Config.WebDeployPath "index.html"
    $indexHtml = Get-Content $indexPath -Raw
    if ($indexHtml -match '/src/main\.tsx') {
        throw "Dev index.html was deployed instead of production build."
    }

    Write-Ok "Frontend rebuilt to $($Config.WebDeployPath)"
}
