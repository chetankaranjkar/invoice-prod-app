# Deployment logging and console output helpers

function Write-DeployLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message,

        [ValidateSet('Deployment', 'Sql', 'Iis', 'Errors')]
        [string]$LogFile = 'Deployment'
    )

    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"

    $ctx = $null
    try { $ctx = Get-DeployContext } catch { }

    if ($ctx) {
        $path = switch ($LogFile) {
            'Sql'    { $ctx.SqlLog }
            'Iis'    { $ctx.IisLog }
            'Errors' { $ctx.ErrorsLog }
            default  { $ctx.DeploymentLog }
        }
        if ($path) {
            Add-Content -Path $path -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
        }
    }
}

function Write-ErrorLog {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message)

    Write-DeployLog $Message -LogFile Errors
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-StepProgress {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    $ctx = Get-DeployContext
    $ctx.CurrentStep++
    $n = $ctx.CurrentStep
    $total = $ctx.TotalSteps
    $label = "[$n/$total] $Message"

    Write-Host ""
    Write-Host $label -ForegroundColor Cyan
    Write-DeployLog $label
}

function Write-Ok {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message)

    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-DeployLog "[OK] $Message"
}

function Write-Warn {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message)

    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    Write-DeployLog "[WARN] $Message"
}

function Write-Err {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message)

    Write-ErrorLog $Message
}

function Write-ValidationReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [array]$Results
    )

    Write-Host ""
    Write-Host "Prerequisite Validation Report" -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray

    foreach ($r in $Results) {
        $icon = if ($r.Passed) { "[PASS]" } else { "[FAIL]" }
        $color = if ($r.Passed) { "Green" } else { "Red" }
        Write-Host "$icon $($r.Name)" -ForegroundColor $color
        if ($r.Detail) {
            Write-Host "       $($r.Detail)" -ForegroundColor Gray
        }
        Write-DeployLog "$icon $($r.Name) - $($r.Detail)"
    }

    Write-Host ("-" * 60) -ForegroundColor DarkGray
}

function Write-DeploymentSummary {
    [CmdletBinding()]
    param()

    $ctx = Get-DeployContext
    $s = $ctx.Summary

    function Format-Line([string]$Label, [bool]$Ok) {
        $icon = if ($Ok) { [char]0x2714 } else { [char]0x2718 }
        $color = if ($Ok) { "Green" } else { "Red" }
        Write-Host "  $icon $Label" -ForegroundColor $color
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " Deployment Summary" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Format-Line "IIS"           $s.Iis
    Format-Line "App Pool"      $s.AppPool
    Format-Line "Website"       $s.Website
    Format-Line "SQL Login"     $s.SqlLogin
    Format-Line "dbcreator"     $s.DbCreator
    Format-Line "Database"      $s.Database
    Format-Line "Permissions"   $s.Permissions
    Format-Line "API Started"   $s.ApiStarted
    Write-Host ""
    Write-Host "Logs:" -ForegroundColor Yellow
    Write-Host "  $($ctx.DeploymentLog)"
    Write-Host "  $($ctx.SqlLog)"
    Write-Host "  $($ctx.IisLog)"
    Write-Host "  $($ctx.ErrorsLog)"
    Write-Host ""
}
