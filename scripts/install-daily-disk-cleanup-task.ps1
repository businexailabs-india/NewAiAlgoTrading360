#Requires -Version 5.1
<#
.SYNOPSIS
  Installs a daily Windows Scheduled Task that runs daily-disk-cleanup.ps1.
  Default: every day at 03:30, reclaim up to 10 GB (temp + stale node_modules).

.EXAMPLE
  # Run PowerShell as Administrator:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install-daily-disk-cleanup-task.ps1

  # Custom time / target:
  .\install-daily-disk-cleanup-task.ps1 -Time 04:00 -TargetGB 10 -NodeModulesMaxAgeDays 14
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'BusineXAi Daily Disk Cleanup',
  [string]$Time = '03:30',
  [double]$TargetGB = 10,
  [int]$NodeModulesMaxAgeDays = 14,
  [switch]$Uninstall,
  [switch]$RunAtLogonAlso
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cleanupScript = Join-Path $scriptDir 'daily-disk-cleanup.ps1'
if (-not (Test-Path -LiteralPath $cleanupScript)) {
  throw "Cleanup script not found: $cleanupScript"
}

# Copy scripts to a stable local folder so task survives if repo moves
$installDir = Join-Path $env:LOCALAPPDATA 'BusineXAi\disk-cleanup'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath $cleanupScript -Destination (Join-Path $installDir 'daily-disk-cleanup.ps1') -Force
$installedScript = Join-Path $installDir 'daily-disk-cleanup.ps1'

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName "$TaskName (Logon)" -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task(s): $TaskName"
  exit 0
}

$arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedScript`" -TargetGB $TargetGB -NodeModulesMaxAgeDays $NodeModulesMaxAgeDays"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable:$false `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Parse HH:mm (24h)
$start = Get-Date -Date ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd'), $Time)
if ($start -lt (Get-Date)) { $start = $start.AddDays(1) }

$triggerDaily = New-ScheduledTaskTrigger -Daily -At $start
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggerDaily `
  -Settings $settings `
  -Principal $principal `
  -Description "Cleans temp/caches and stale node_modules across disks; stops around ${TargetGB} GB per run. Logs: $installDir" `
  -Force | Out-Null

Write-Host "Installed daily task: '$TaskName'"
Write-Host "  Runs daily at $Time"
Write-Host "  Script: $installedScript"
Write-Host "  Target: ${TargetGB} GB / node_modules age > ${NodeModulesMaxAgeDays} days"
Write-Host "  Logs:   $installDir\cleanup-YYYYMMDD.log"

if ($RunAtLogonAlso) {
  $logonName = "$TaskName (Logon)"
  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  Register-ScheduledTask `
    -TaskName $logonName `
    -Action $action `
    -Trigger $triggerLogon `
    -Settings $settings `
    -Principal $principal `
    -Description "Same cleanup on user logon (optional)." `
    -Force | Out-Null
  Write-Host "Also installed logon task: '$logonName'"
}

Write-Host ""
Write-Host "Test now:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$installedScript`" -WhatIf"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "Uninstall:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"
