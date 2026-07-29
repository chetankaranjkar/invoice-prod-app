# Shared deployment context - initialized once by deploy-iis.ps1

function Initialize-DeployContext {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    $script:DeployContext = @{
        Config        = $Config
        Summary       = [ordered]@{
            Prerequisites = $false
            SqlDetection  = $false
            SqlConnection = $false
            Build         = $false
            Configuration = $false
            Iis           = $false
            AppPool       = $false
            Website       = $false
            SqlLogin      = $false
            DbCreator     = $false
            Database      = $false
            Permissions   = $false
            ApiStarted    = $false
        }
        RollbackItems = [System.Collections.Generic.List[hashtable]]::new()
        SqlCmdPath    = $null
        SqlServer     = $null
        SqlInstances  = @()
        TotalSteps    = 12
        CurrentStep   = 0
        LogRoot       = Join-Path $Config.DeployRoot "logs\deploy"
        DeploymentLog = $null
        SqlLog        = $null
        IisLog        = $null
        ErrorsLog     = $null
    }

    $ctx = $script:DeployContext
    $logDirs = @($ctx.LogRoot)
    if ($Config.ApiDeployPath) { $logDirs += $Config.ApiDeployPath }
    if ($Config.WebDeployPath) { $logDirs += $Config.WebDeployPath }

    foreach ($dir in $logDirs) {
        if ($dir -and -not (Test-Path $dir)) {
            try { New-Item -ItemType Directory -Path $dir -Force | Out-Null } catch { }
        }
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $ctx.DeploymentLog = Join-Path $ctx.LogRoot "Deployment.log"
    $ctx.SqlLog          = Join-Path $ctx.LogRoot "SQL.log"
    $ctx.IisLog          = Join-Path $ctx.LogRoot "IIS.log"
    $ctx.ErrorsLog       = Join-Path $ctx.LogRoot "Errors.log"

    foreach ($logFile in @($ctx.DeploymentLog, $ctx.SqlLog, $ctx.IisLog, $ctx.ErrorsLog)) {
        if (-not (Test-Path $logFile)) {
            New-Item -ItemType File -Path $logFile -Force | Out-Null
        }
        Add-Content -Path $logFile -Value "===== Deployment started $timestamp ====="
    }
}

function Get-DeployContext {
    return $script:DeployContext
}

function Register-RollbackAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Description,

        [Parameter(Mandatory)]
        [scriptblock]$Action
    )

    $ctx = Get-DeployContext
    $ctx.RollbackItems.Add(@{
        Description = $Description
        Action      = $Action
    })
    Write-DeployLog "Registered rollback: $Description"
}

function Invoke-DeployRollback {
    [CmdletBinding()]
    param()

    $ctx = Get-DeployContext
    if ($ctx.RollbackItems.Count -eq 0) {
        Write-DeployLog "No rollback actions registered."
        return
    }

    Write-DeployLog "Starting rollback ($($ctx.RollbackItems.Count) actions)..."
    for ($i = $ctx.RollbackItems.Count - 1; $i -ge 0; $i--) {
        $item = $ctx.RollbackItems[$i]
        try {
            Write-DeployLog "ROLLBACK: $($item.Description)"
            & $item.Action
        }
        catch {
            Write-ErrorLog "Rollback failed ($($item.Description)): $($_.Exception.Message)"
        }
    }
}

function Set-DeploySummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Key,

        [bool]$Value = $true
    )

    $ctx = Get-DeployContext
    if ($ctx.Summary.Contains($Key)) {
        $ctx.Summary[$Key] = $Value
    }
}
