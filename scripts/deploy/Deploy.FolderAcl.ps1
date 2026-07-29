# Deploy.FolderAcl.ps1 v3 - loaded LAST by deploy-iis.ps1 (overrides stale Deploy.Iis.ps1)

function Grant-FolderAcl {
    [CmdletBinding()]
    param(
        [string]$Path,
        [string[]]$Accounts,
        [string]$Rights = 'M'
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

            $targets = @($Path)
            $targets += @(
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
                    if (Get-Command Write-DeployLog -ErrorAction SilentlyContinue) {
                        Write-DeployLog "ACL skip $target for $account : $($_.Exception.Message)" -LogFile Iis
                    }
                }
            }

            if (Get-Command Write-DeployLog -ErrorAction SilentlyContinue) {
                Write-DeployLog "Granted $Rights to $account on $Path (Set-Acl)" -LogFile Iis
            }
        }
        catch {
            if (Get-Command Write-Warn -ErrorAction SilentlyContinue) {
                Write-Warn "Could not grant ACL for ${account} on ${Path}: $($_.Exception.Message)"
            }
        }
    }
}
