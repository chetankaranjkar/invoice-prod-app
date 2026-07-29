# Deploy.Iis.ps1 version 3 - IIS sites and app pools (ACL: see Deploy.FolderAcl.ps1)

function Ensure-IisServicesRunning {
    foreach ($name in @("WAS", "W3SVC")) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $svc) {
            Write-DeployLog "Service not found: $name" -LogFile Iis
            continue
        }
        if ($svc.Status -ne "Running") {
            Write-DeployLog "Starting service: $name" -LogFile Iis
            Start-Service -Name $name -ErrorAction Stop
        }
    }
    Start-Sleep -Seconds 2
}

function Enable-ArrProxySettings {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    try {
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "preserveHostHeader" -Value "False"
        Write-DeployLog "ARR proxy enabled" -LogFile Iis
        return $true
    }
    catch {
        Write-Warn "Could not enable ARR proxy: $($_.Exception.Message)"
        return $false
    }
}

function Ensure-AppPool {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [string]$ManagedRuntimeVersion = "",
        [string]$StartMode = "OnDemand"
    )

    Import-Module WebAdministration -ErrorAction Stop
    $path = "IIS:\AppPools\$Name"

    if (Test-Path $path) {
        Write-DeployLog "App pool exists, updating settings: $Name" -LogFile Iis
        Set-ItemProperty $path -Name managedRuntimeVersion -Value $ManagedRuntimeVersion
        Set-ItemProperty $path -Name startMode -Value $StartMode
        Write-Ok "App pool updated: $Name"
    }
    else {
        New-WebAppPool -Name $Name | Out-Null
        Set-ItemProperty $path -Name managedRuntimeVersion -Value $ManagedRuntimeVersion
        Set-ItemProperty $path -Name startMode -Value $StartMode
        Write-Ok "App pool created: $Name"
    }

    Set-DeploySummary -Key AppPool -Value $true
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

    $hasLocal = Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue |
        Where-Object { $_.bindingInformation -eq "127.0.0.1:${Port}:" }

    if (-not $hasLocal) {
        New-WebBinding -Name $SiteName -Protocol "http" -IPAddress "127.0.0.1" -Port $Port | Out-Null
        Write-DeployLog "Added localhost binding for $SiteName on port $Port" -LogFile Iis
    }
}

function Resolve-WebPortBindingConflict {
    param(
        [string]$PreferredSiteName,
        [int]$Port = 80,
        [string]$HostHeader = ""
    )

    Import-Module WebAdministration -ErrorAction Stop

    $targetBinding = if ([string]::IsNullOrEmpty($HostHeader)) {
        "*:${Port}:"
    }
    else {
        "*:${Port}:${HostHeader}"
    }

    foreach ($site in @(Get-Website)) {
        if ($site.Name -eq $PreferredSiteName) { continue }

        $bindings = @(Get-WebBinding -Name $site.Name -Protocol "http" -ErrorAction SilentlyContinue)
        foreach ($binding in $bindings) {
            $info = $binding.bindingInformation
            if ($info -ne $targetBinding) { continue }

            Write-Warn "HTTP binding conflict: '$($site.Name)' uses $info (needed by '$PreferredSiteName')"
            if ($site.Name -eq "Default Web Site") {
                Remove-WebBinding -Name $site.Name -Protocol http -BindingInformation $info -ErrorAction Stop
                try {
                    Stop-Website -Name $site.Name -ErrorAction Stop
                    Write-Ok "Stopped Default Web Site (freed port $Port for Invoice Master)"
                }
                catch {
                    Write-Warn "Could not stop Default Web Site: $($_.Exception.Message)"
                }
                Write-Ok "Removed binding $info from Default Web Site"
                Write-DeployLog "Removed Default Web Site binding $info" -LogFile Iis
            }
            else {
                try {
                    Stop-Website -Name $site.Name -ErrorAction Stop
                    Write-Ok "Stopped conflicting site: $($site.Name)"
                    Write-DeployLog "Stopped conflicting site $($site.Name) on $info" -LogFile Iis
                }
                catch {
                    Write-Warn "Could not stop site '$($site.Name)': $($_.Exception.Message)"
                }
            }
        }
    }

    if (-not (Get-Website -Name $PreferredSiteName -ErrorAction SilentlyContinue)) { return }

    $hasBinding = @(Get-WebBinding -Name $PreferredSiteName -Protocol "http" -ErrorAction SilentlyContinue) |
        Where-Object { $_.bindingInformation -eq $targetBinding }
    if ($hasBinding) { return }

    if ([string]::IsNullOrEmpty($HostHeader)) {
        New-WebBinding -Name $PreferredSiteName -Protocol http -Port $Port | Out-Null
    }
    else {
        New-WebBinding -Name $PreferredSiteName -Protocol http -Port $Port -HostHeader $HostHeader | Out-Null
    }
    Write-DeployLog "Added binding $targetBinding to $PreferredSiteName" -LogFile Iis
}

function Ensure-Website {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$PhysicalPath,

        [Parameter(Mandatory)]
        [string]$AppPoolName,

        [int]$Port = 80,
        [string]$HostHeader = "",
        [switch]$LocalhostOnlyApi
    )

    Import-Module WebAdministration -ErrorAction Stop

    if (-not $LocalhostOnlyApi) {
        Resolve-WebPortBindingConflict -PreferredSiteName $Name -Port $Port -HostHeader $HostHeader
    }

    if (-not (Test-Path $PhysicalPath)) {
        New-Item -ItemType Directory -Path $PhysicalPath -Force | Out-Null
        Write-DeployLog "Created physical path: $PhysicalPath" -LogFile Iis
    }

    $site = Get-Website -Name $Name -ErrorAction SilentlyContinue
    if ($site) {
        Write-DeployLog "Website exists, updating: $Name" -LogFile Iis
        Set-ItemProperty "IIS:\Sites\$Name" -Name physicalPath -Value $PhysicalPath
        Set-ItemProperty "IIS:\Sites\$Name" -Name applicationPool -Value $AppPoolName
        Write-Ok "Website updated: $Name"
    }
    else {
        if ($LocalhostOnlyApi) {
            New-Website -Name $Name -PhysicalPath $PhysicalPath -ApplicationPool $AppPoolName -Port $Port -HostHeader "" | Out-Null
            Set-ApiSiteLocalhostBinding -SiteName $Name -Port $Port
        }
        else {
            New-Website -Name $Name -PhysicalPath $PhysicalPath -ApplicationPool $AppPoolName -Port $Port | Out-Null
        }
        Write-Ok "Website created: $Name"
    }

    if ($LocalhostOnlyApi) {
        Set-ApiSiteLocalhostBinding -SiteName $Name -Port $Port
    }

    Set-DeploySummary -Key Website -Value $true
    Set-DeploySummary -Key Iis -Value $true
}

function Start-IisAppPoolSafe {
    param([string]$AppPoolName)

    if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) { return }

    try {
        $state = (Get-WebAppPoolState -Name $AppPoolName).Value
        if ($state -eq "Started") { return }
        Start-WebAppPool -Name $AppPoolName -ErrorAction Stop
        Write-DeployLog "Started app pool: $AppPoolName" -LogFile Iis
    }
    catch {
        Write-Warn "Start-WebAppPool ${AppPoolName}: $($_.Exception.Message)"
        Ensure-IisServicesRunning
        Start-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
    }
}

function Start-IisSiteSafe {
    param([string]$SiteName)

    $maxAttempts = 5
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
            if (-not $site) { throw "Site '$SiteName' does not exist" }
            if ($site.State -eq "Started") { return }

            Start-Website -Name $SiteName -ErrorAction Stop
            Write-DeployLog "Started site: $SiteName" -LogFile Iis
            return
        }
        catch {
            Write-Warn "Start-Website $SiteName attempt $attempt/$maxAttempts : $($_.Exception.Message)"
            Ensure-IisServicesRunning
            if ($attempt -eq 3) {
                & iisreset /noforce 2>$null | Out-Null
                Start-Sleep -Seconds 3
            }
            else {
                Start-Sleep -Seconds (2 * $attempt)
            }
        }
    }

    $appcmd = Join-Path $env:SystemRoot "System32\inetsrv\appcmd.exe"
    if (Test-Path $appcmd) {
        & $appcmd start site /site.name:"$SiteName" | Out-Null
        if ($LASTEXITCODE -eq 0) { return }
    }

    throw "Could not start IIS site '$SiteName'"
}

function Stop-IisSitesForPublish {
    param(
        [string[]]$SiteNames,
        [string[]]$AppPoolNames
    )

    Import-Module WebAdministration -ErrorAction SilentlyContinue
    if (-not (Get-Module WebAdministration)) { return }

    foreach ($site in $SiteNames) {
        try {
            $website = Get-Website -Name $site -ErrorAction SilentlyContinue
            if ($website -and $website.State -ne "Stopped") {
                Write-DeployLog "Stopping site for publish: $site" -LogFile Iis
                Stop-Website -Name $site -ErrorAction Stop
            }
        }
        catch {
            Write-Warn "Could not stop site ${site}: $($_.Exception.Message)"
        }
    }

    foreach ($pool in $AppPoolNames) {
        try {
            if (-not (Test-Path "IIS:\AppPools\$pool")) { continue }
            $state = (Get-WebAppPoolState -Name $pool).Value
            if ($state -ne "Stopped") {
                Write-DeployLog "Stopping app pool for publish: $pool" -LogFile Iis
                Stop-WebAppPool -Name $pool -ErrorAction Stop
            }
        }
        catch {
            Write-Warn "Could not stop app pool ${pool}: $($_.Exception.Message)"
        }
    }

    Start-Sleep -Seconds 3
}

function Grant-FolderAcl {
    param(
        [string]$Path,
        [string[]]$Accounts,
        [string]$Rights = "M"
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }

    $fsRights = switch ($Rights.ToUpperInvariant()) {
        'F'  { [System.Security.AccessControl.FileSystemRights]::FullControl }
        'RX' { [System.Security.AccessControl.FileSystemRights]::ReadAndExecute }
        default { [System.Security.AccessControl.FileSystemRights]::Modify }
    }

    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor `
        [System.Security.AccessControl.InheritanceFlags]::ObjectInherit

    foreach ($account in @($Accounts)) {
        if ([string]::IsNullOrWhiteSpace($account)) { continue }

        try {
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                $account,
                $fsRights,
                $inherit,
                [System.Security.AccessControl.PropagationFlags]::None,
                [System.Security.AccessControl.AccessControlType]::Allow
            )

            $targets = @($Path) + @(
                Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
                    Select-Object -ExpandProperty FullName
            )

            foreach ($target in $targets) {
                try {
                    $acl = Get-Acl -LiteralPath $target
                    $acl.AddAccessRule($rule)
                    Set-Acl -LiteralPath $target -AclObject $acl
                }
                catch {
                    Write-DeployLog "ACL skip $target for $account : $($_.Exception.Message)" -LogFile Iis
                }
            }

            Write-DeployLog "Granted $Rights to $account on $Path (recursive)" -LogFile Iis
        }
        catch {
            Write-Warn "Could not grant ACL for ${account} on ${Path}: $($_.Exception.Message)"
            Write-DeployLog "ACL failed: $account -> $Path : $($_.Exception.Message)" -LogFile Iis
        }
    }
}

function Invoke-IisDeployment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    Ensure-IisServicesRunning
    Enable-ArrProxySettings | Out-Null

    Ensure-AppPool -Name $Config.ApiAppPool -ManagedRuntimeVersion "" -StartMode "AlwaysRunning"
    Ensure-AppPool -Name $Config.WebAppPool -ManagedRuntimeVersion "" -StartMode "OnDemand"

    Ensure-Website -Name $Config.ApiSiteName -PhysicalPath $Config.ApiDeployPath `
        -AppPoolName $Config.ApiAppPool -Port $Config.ApiPort -LocalhostOnlyApi

    Ensure-Website -Name $Config.WebSiteName -PhysicalPath $Config.WebDeployPath `
        -AppPoolName $Config.WebAppPool -Port $Config.WebPort

    $sqlServiceAccounts = @(
        "NT SERVICE\MSSQLSERVER",
        "NT SERVICE\MSSQL`$SQLEXPRESS"
    )

    $wwwrootAccounts = @(
        $Config.ApiPoolIdentity
        'IIS_IUSRS'
        'NETWORK SERVICE'
    )
    $backupAccounts = @(
        $Config.ApiPoolIdentity
        'IIS_IUSRS'
    ) + @($sqlServiceAccounts)
    $logsAccounts = @(
        $Config.ApiPoolIdentity
        'IIS_IUSRS'
    )

    Grant-FolderAcl -Path (Join-Path $Config.ApiDeployPath 'wwwroot') -Accounts $wwwrootAccounts
    Grant-FolderAcl -Path $Config.BackupsPath -Accounts $backupAccounts
    Grant-FolderAcl -Path $Config.LogsPath -Accounts $logsAccounts

    Start-IisAppPoolSafe -AppPoolName $Config.ApiAppPool
    Start-IisAppPoolSafe -AppPoolName $Config.WebAppPool
    Start-IisSiteSafe -SiteName $Config.ApiSiteName
    Start-IisSiteSafe -SiteName $Config.WebSiteName
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
            Write-Host "  Waiting for $Url ($i/$Retries)..." -ForegroundColor Gray
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    return $false
}
