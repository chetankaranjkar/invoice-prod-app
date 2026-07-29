# Phase 2-3, 5-9: SQL Server detection, validation, login, roles, permissions

function Get-SqlCmdPath {
    $candidates = @(
        "sqlcmd",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\140\Tools\Binn\SQLCMD.EXE"
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

function Get-SqlInstancesFromServices {
    $instances = [System.Collections.Generic.List[pscustomobject]]::new()
    $computer = $env:COMPUTERNAME

    Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -eq "MSSQLSERVER") {
            [void]$instances.Add([pscustomobject]@{
                InstanceName  = "MSSQLSERVER"
                ServerString  = $computer
                Source        = "Service"
                IsRunning     = ($_.Status -eq "Running")
                Edition       = "Unknown"
            })
        }
        elseif ($_.Name -match '^MSSQL\$(.+)$') {
            $inst = $Matches[1]
            [void]$instances.Add([pscustomobject]@{
                InstanceName  = $inst
                ServerString  = "$computer\$inst"
                Source        = "Service"
                IsRunning     = ($_.Status -eq "Running")
                Edition       = if ($inst -eq "SQLEXPRESS") { "Express" } else { "Named" }
            })
        }
    }

    # LocalDB
    $localDbVersions = @()
    $localDbKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server Local DB\Installed Versions"
    if (Test-Path $localDbKey) {
        $localDbVersions = (Get-ChildItem $localDbKey -ErrorAction SilentlyContinue).PSChildName
    }
    foreach ($ver in $localDbVersions) {
        [void]$instances.Add([pscustomobject]@{
            InstanceName  = "LocalDB_$ver"
            ServerString  = "(localdb)\$ver"
            Source        = "LocalDB"
            IsRunning     = $true
            Edition       = "LocalDB"
        })
    }

    return $instances
}

function Get-SqlInstancesFromRegistry {
    $instances = [System.Collections.Generic.List[pscustomobject]]::new()
    $computer = $env:COMPUTERNAME
    $key = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"

    if (-not (Test-Path $key)) { return @() }

    $props = Get-ItemProperty $key
    foreach ($prop in $props.PSObject.Properties) {
        if ($prop.Name -match '^PS') { continue }
        $name = [string]$prop.Name
        if ($name -eq "MSSQLSERVER") {
            [void]$instances.Add([pscustomobject]@{
                InstanceName = "MSSQLSERVER"
                ServerString = $computer
                Source       = "Registry"
                IsRunning    = $false
                Edition      = "Unknown"
            })
        }
        else {
            [void]$instances.Add([pscustomobject]@{
                InstanceName = $name
                ServerString = "$computer\$name"
                Source       = "Registry"
                IsRunning    = $false
                Edition      = if ($name -eq "SQLEXPRESS") { "Express" } else { "Named" }
            })
        }
    }
    return $instances
}

function Get-SqlInstancesFromSqlCmdList {
    $instances = [System.Collections.Generic.List[pscustomobject]]::new()
    $ctx = Get-DeployContext
    $sqlcmd = $ctx.SqlCmdPath
    if (-not $sqlcmd) { return @() }

    $output = & $sqlcmd -L 2>&1
    Write-DeployLog "sqlcmd -L output:`n$($output -join "`n")" -LogFile Sql

    foreach ($line in $output) {
        $trimmed = ([string]$line).Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
        if ($trimmed -match 'Servers found|^\s*$') { continue }
        # Lines like "COMPUTER\INSTANCE" or "COMPUTER"
        $server = $trimmed -replace ',\d+$', ''
        if ($server -match '\\') {
            $parts = $server -split '\\', 2
            [void]$instances.Add([pscustomobject]@{
                InstanceName = $parts[1]
                ServerString = $server
                Source       = "SqlCmd-L"
                IsRunning    = $false
                Edition      = "Unknown"
            })
        }
        else {
            [void]$instances.Add([pscustomobject]@{
                InstanceName = "MSSQLSERVER"
                ServerString = $server
                Source       = "SqlCmd-L"
                IsRunning    = $false
                Edition      = "Unknown"
            })
        }
    }
    return $instances
}

function Get-SqlInstances {
    [CmdletBinding()]
    param()

    $merged = @{}
    $priority = 0

    foreach ($inst in (Get-SqlInstancesFromServices)) {
        $key = $inst.ServerString.ToUpperInvariant()
        if (-not $merged.ContainsKey($key)) {
            $merged[$key] = $inst
        }
        else {
            if ($inst.IsRunning) { $merged[$key].IsRunning = $true }
            $merged[$key].Source = "$($merged[$key].Source)+Service"
        }
    }

    foreach ($inst in (Get-SqlInstancesFromRegistry)) {
        $key = $inst.ServerString.ToUpperInvariant()
        if (-not $merged.ContainsKey($key)) {
            $merged[$key] = $inst
        }
        else {
            $merged[$key].Source = "$($merged[$key].Source)+Registry"
        }
    }

    # SQL Browser: if running, note it
    $browser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
    if ($browser -and $browser.Status -eq "Running") {
        Write-DeployLog "SQL Browser service is running" -LogFile Sql
    }

    foreach ($inst in (Get-SqlInstancesFromSqlCmdList)) {
        $key = $inst.ServerString.ToUpperInvariant()
        if (-not $merged.ContainsKey($key)) {
            $merged[$key] = $inst
        }
        else {
            $merged[$key].Source = "$($merged[$key].Source)+SqlCmd-L"
        }
    }

    return $merged.Values | Sort-Object -Property @{ Expression = { - [int]$_.IsRunning } }, InstanceName
}

function Start-SqlServices {
    $services = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue
    if (-not $services) { return $false }

    foreach ($svc in $services) {
        if ($svc.Status -ne "Running") {
            Write-DeployLog "Starting SQL service: $($svc.Name)" -LogFile Sql
            try { Start-Service $svc.Name -ErrorAction Stop } catch {
                Write-Warn "Could not start $($svc.Name): $($_.Exception.Message)"
            }
        }
    }

    $browser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
    if ($browser -and $browser.Status -ne "Running") {
        try { Start-Service SQLBrowser -ErrorAction SilentlyContinue } catch { }
    }

    Start-Sleep -Seconds 3
    return $true
}

function Invoke-SqlQuery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [string]$Query,

        [switch]$Scalar,
        [switch]$AllowFailure
    )

    $ctx = Get-DeployContext
    $sqlcmd = $ctx.SqlCmdPath
    if (-not $sqlcmd) {
        throw "sqlcmd is not available"
    }

    Write-DeployLog "SQL> $Query" -LogFile Sql
    Write-DeployLog "SQL Server: $Server" -LogFile Sql

    $args = @("-S", $Server, "-E", "-b", "-Q", $Query)
    if ($Scalar) { $args += @("-h", "-1", "-W") }

    $output = & $sqlcmd @args 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | ForEach-Object { "$_" }) -join "`n"

    Write-DeployLog "SQL output (exit $exitCode):`n$text" -LogFile Sql

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        Write-Host $text -ForegroundColor Red
        throw "SQL command failed (exit $exitCode):`n$text"
    }

    return @{
        Success  = ($exitCode -eq 0)
        Output   = @($output)
        ExitCode = $exitCode
        Text     = $text
    }
}

function Test-SqlConnection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server
    )

    try {
        $result = Invoke-SqlQuery -Server $Server -Query "SET NOCOUNT ON; SELECT 1 AS Connected;" -Scalar
        return $result.Success
    }
    catch {
        Write-DeployLog "Connection test failed for ${Server}: $($_.Exception.Message)" -LogFile Sql
        return $false
    }
}

function Test-SqlSysAdmin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server
    )

    $result = Invoke-SqlQuery -Server $Server -Query "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin');" -Scalar
    if (-not $result.Success) { return $false }

    $value = ($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)
    return ([string]$value).Trim() -eq "1"
}

function Invoke-SqlConnectionValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server
    )

    Write-DeployLog "Validating SQL connection to: $Server" -LogFile Sql

    if (-not (Test-SqlConnection -Server $Server)) {
        throw "Cannot connect to SQL Server '$Server'. See SQL.log for sqlcmd output."
    }
    Write-Ok "SQL connection succeeded (Windows Authentication)"

    if (-not (Test-SqlSysAdmin -Server $Server)) {
        throw "Current Windows user is not a sysadmin on '$Server'. Deployment requires sysadmin to create logins and grant roles."
    }
    Write-Ok "Current user has sysadmin role"

    Set-DeploySummary -Key SqlConnection -Value $true
}

function Resolve-SqlServerInstance {
    [CmdletBinding()]
    param(
        [string]$PreferredInstance = ""
    )

    Start-SqlServices | Out-Null

    $instances = @(Get-SqlInstances)
    $ctx = Get-DeployContext
    $ctx.SqlInstances = $instances

    if ($instances.Count -eq 0) {
        throw "No SQL Server instances detected on this machine."
    }

    Write-Host "Detected SQL instances:" -ForegroundColor Gray
    foreach ($inst in $instances) {
        $run = if ($inst.IsRunning) { "running" } else { "stopped" }
        Write-Host "  $($inst.ServerString) [$($inst.Edition)] ($run, source: $($inst.Source))" -ForegroundColor Gray
        Write-DeployLog "Instance: $($inst.ServerString) edition=$($inst.Edition) running=$($inst.IsRunning) source=$($inst.Source)" -LogFile Sql
    }

    if (-not [string]::IsNullOrWhiteSpace($PreferredInstance)) {
        Write-DeployLog "Using preferred instance from parameter: $PreferredInstance" -LogFile Sql
        if (-not (Test-SqlConnection -Server $PreferredInstance)) {
            throw "Cannot connect to specified -SqlServer '$PreferredInstance'. See SQL.log."
        }
        $ctx.SqlServer = $PreferredInstance
        Set-DeploySummary -Key SqlDetection -Value $true
        return $PreferredInstance
    }

    # Try connectable instances: running first
    $connectable = @()
    foreach ($inst in ($instances | Where-Object { $_.IsRunning })) {
        if (Test-SqlConnection -Server $inst.ServerString) {
            $connectable += $inst
        }
    }
    if ($connectable.Count -eq 0) {
        foreach ($inst in $instances) {
            if (Test-SqlConnection -Server $inst.ServerString) {
                $connectable += $inst
            }
        }
    }

    if ($connectable.Count -eq 0) {
        throw "SQL instances were detected but none accepted a connection. See SQL.log."
    }

    if ($connectable.Count -gt 1) {
        Write-Warn "Multiple SQL instances are connectable. Using: $($connectable[0].ServerString)"
        Write-Warn "Specify -SqlServer to choose a different instance."
    }

    $selected = $connectable[0].ServerString
    $ctx.SqlServer = $selected
    Set-DeploySummary -Key SqlDetection -Value $true
    Write-Ok "Selected SQL Server: $selected"
    return $selected
}

function Test-SqlDatabaseExists {
    param(
        [string]$Server,
        [string]$Database
    )

    $escaped = $Database.Replace("'", "''")
    $result = Invoke-SqlQuery -Server $Server -Query "SET NOCOUNT ON; SELECT CAST(DB_ID(N'$escaped') AS nvarchar(20));" -Scalar -AllowFailure
    if (-not $result.Success) { return $false }

    $id = ([string]($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)).Trim()
    return $id -and $id -ne "NULL" -and $id -ne "0"
}

function Wait-ForSqlDatabase {
    param(
        [string]$Server,
        [string]$Database,
        [int]$Retries = 60,
        [int]$DelaySeconds = 5
    )

    for ($i = 1; $i -le $Retries; $i++) {
        if (Test-SqlDatabaseExists -Server $Server -Database $Database) {
            return $true
        }
        Write-Host "  Waiting for database '$Database' ($i/$Retries)..." -ForegroundColor Gray
        Start-Sleep -Seconds $DelaySeconds
    }
    return $false
}

function Test-SqlLoginExists {
    param(
        [string]$Server,
        [string]$LoginName
    )

    $escaped = $LoginName.Replace("'", "''")
    $result = Invoke-SqlQuery -Server $Server -Query "SET NOCOUNT ON; SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$escaped') THEN 1 ELSE 0 END;" -Scalar
    $value = ([string]($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)).Trim()
    return $value -eq "1"
}

function Ensure-SqlLogin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [string]$LoginName
    )

    if (Test-SqlLoginExists -Server $Server -LoginName $LoginName) {
        Write-Ok "SQL login already exists: $LoginName"
        Set-DeploySummary -Key SqlLogin -Value $true
        return $true
    }

    $escaped = $LoginName.Replace("'", "''")
    $bracketName = $LoginName -replace '\]', ']]'
    Invoke-SqlQuery -Server $Server -Query "CREATE LOGIN [$bracketName] FROM WINDOWS;" | Out-Null
    Write-Ok "Created SQL login: $LoginName"
    Set-DeploySummary -Key SqlLogin -Value $true
    return $true
}

function Test-DbCreatorGranted {
    param(
        [string]$Server,
        [string]$LoginName
    )

    $escaped = $LoginName.Replace("'", "''")
    $query = @"
SET NOCOUNT ON;
SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM sys.server_role_members rm
    INNER JOIN sys.server_principals role_p ON rm.role_principal_id = role_p.principal_id
    INNER JOIN sys.server_principals member_p ON rm.member_principal_id = member_p.principal_id
    WHERE role_p.name = N'dbcreator' AND member_p.sid = SUSER_SID(N'$escaped')
) THEN 1 ELSE 0 END;
"@
    $result = Invoke-SqlQuery -Server $Server -Query $query -Scalar
    $value = ([string]($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)).Trim()
    return $value -eq "1"
}

function Ensure-DbCreator {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [string]$LoginName
    )

    if (Test-DbCreatorGranted -Server $Server -LoginName $LoginName) {
        Write-Ok "dbcreator already granted to $LoginName"
        Set-DeploySummary -Key DbCreator -Value $true
        return $true
    }

    $bracketName = $LoginName -replace '\]', ']]'
    Invoke-SqlQuery -Server $Server -Query "ALTER SERVER ROLE dbcreator ADD MEMBER [$bracketName];" | Out-Null
    Write-Ok "Granted dbcreator to $LoginName"
    Set-DeploySummary -Key DbCreator -Value $true
    return $true
}

function Test-SqlLoginMappedInDatabase {
    param(
        [string]$Server,
        [string]$Database,
        [string]$LoginName
    )

    if (-not (Test-SqlDatabaseExists -Server $Server -Database $Database)) {
        return $false
    }

    $escapedLogin = $LoginName.Replace("'", "''")
    $escapedDb = $Database.Replace("'", "''")
    # sys.databases.owner_sid (SQL 2008-2022); OWNER_SID() is not available on Express
    $query = @"
SET NOCOUNT ON;
SELECT CASE
    WHEN DB_ID(N'$escapedDb') IS NULL THEN 0
    WHEN EXISTS (
        SELECT 1
        FROM sys.databases d
        WHERE d.name = N'$escapedDb'
          AND d.owner_sid = SUSER_SID(N'$escapedLogin')
    ) THEN 1
    WHEN EXISTS (
        SELECT 1
        FROM [$Database].sys.database_principals dp
        WHERE dp.sid = SUSER_SID(N'$escapedLogin')
    ) THEN 1
    ELSE 0
END;
"@
    $result = Invoke-SqlQuery -Server $Server -Query $query -Scalar
    $value = ([string]($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)).Trim()
    return $value -eq "1"
}

function Test-DatabaseDbOwner {
    param(
        [string]$Server,
        [string]$Database,
        [string]$LoginName
    )

    if (-not (Test-SqlDatabaseExists -Server $Server -Database $Database)) {
        return $false
    }

    $escapedLogin = $LoginName.Replace("'", "''")
    $escapedDb = $Database.Replace("'", "''")
    $query = @"
SET NOCOUNT ON;
SELECT CASE
    WHEN DB_ID(N'$escapedDb') IS NULL THEN 0
    WHEN EXISTS (
        SELECT 1
        FROM sys.databases d
        WHERE d.name = N'$escapedDb'
          AND d.owner_sid = SUSER_SID(N'$escapedLogin')
    ) THEN 1
    WHEN EXISTS (
        SELECT 1
        FROM [$Database].sys.database_role_members drm
        INNER JOIN [$Database].sys.database_principals role_p ON drm.role_principal_id = role_p.principal_id
        INNER JOIN [$Database].sys.database_principals member_p ON drm.member_principal_id = member_p.principal_id
        WHERE role_p.name = N'db_owner' AND member_p.sid = SUSER_SID(N'$escapedLogin')
    ) THEN 1
    ELSE 0
END;
"@
    $result = Invoke-SqlQuery -Server $Server -Query $query -Scalar
    $value = ([string]($result.Output | Where-Object { $_ -and $_ -notmatch 'rows affected' } | Select-Object -First 1)).Trim()
    return $value -eq "1"
}

function Ensure-DatabaseUser {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [string]$Database,

        [Parameter(Mandatory)]
        [string]$LoginName
    )

    if (-not (Test-SqlDatabaseExists -Server $Server -Database $Database)) {
        Write-DeployLog "Database '$Database' does not exist - skipping user creation (EF will create DB)" -LogFile Sql
        return $false
    }

    if (Test-SqlLoginMappedInDatabase -Server $Server -Database $Database -LoginName $LoginName) {
        Write-Ok "Login already mapped in database '$Database' (SID match or dbo owner)"
        return $true
    }

    $bracketLogin = $LoginName -replace '\]', ']]'
    $query = @"
USE [$Database];
CREATE USER [$bracketLogin] FOR LOGIN [$bracketLogin];
"@
    Invoke-SqlQuery -Server $Server -Query $query | Out-Null
    Write-Ok "Created database user for $LoginName in $Database"
    return $true
}

function Grant-DatabasePermissions {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [string]$Database,

        [Parameter(Mandatory)]
        [string]$LoginName
    )

    if (-not (Test-SqlDatabaseExists -Server $Server -Database $Database)) {
        Write-DeployLog "Database '$Database' does not exist - skipping db_owner grant" -LogFile Sql
        return $false
    }

    if (-not (Test-SqlLoginMappedInDatabase -Server $Server -Database $Database -LoginName $LoginName)) {
        Ensure-DatabaseUser -Server $Server -Database $Database -LoginName $LoginName | Out-Null
    }

    if (Test-DatabaseDbOwner -Server $Server -Database $Database -LoginName $LoginName) {
        Write-Ok "db_owner already effective for $LoginName on $Database"
        Set-DeploySummary -Key Permissions -Value $true
        return $true
    }

    $bracketLogin = $LoginName -replace '\]', ']]'
    $query = @"
USE [$Database];
ALTER ROLE db_owner ADD MEMBER [$bracketLogin];
"@
    Invoke-SqlQuery -Server $Server -Query $query | Out-Null
    Write-Ok "Granted db_owner to $LoginName on $Database"
    Set-DeploySummary -Key Permissions -Value $true
    return $true
}

function New-SqlConnectionString {
    param(
        [string]$Server,
        [string]$Database
    )
    return "Server=$Server;Database=$Database;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=true"
}
