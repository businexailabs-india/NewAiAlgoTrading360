#Requires -Version 5.1
<#
.SYNOPSIS
  Daily disk cleanup: temp/cache files + stale node_modules across fixed drives.
  Stops after reclaiming about -TargetGB (default 10) gigabytes.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\daily-disk-cleanup.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\daily-disk-cleanup.ps1 -WhatIf
#>
[CmdletBinding()]
param(
  [double]$TargetGB = 10,
  [int]$NodeModulesMaxAgeDays = 14,
  [string[]]$ExcludePathPrefixes = @(
    'C:\BusineXAiLab\BxAiTradePortfolioOps360',
    'C:\Program Files',
    'C:\Program Files (x86)',
    'C:\Windows',
    'C:\ProgramData\Microsoft',
    "$env:LOCALAPPDATA\Programs"
  ),
  [switch]$WhatIf
)

$ErrorActionPreference = 'SilentlyContinue'

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  Write-Host $line
  if ($script:LogFile) {
    Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
  }
}

function Get-DirSizeBytes {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return [int64]0 }
  $sum = [int64]0
  Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
    ForEach-Object { $sum += [int64]$_.Length }
  return $sum
}

function Test-IsExcluded {
  param([string]$Path)
  try {
    $full = [System.IO.Path]::GetFullPath($Path)
  } catch {
    return $true
  }
  foreach ($ex in $ExcludePathPrefixes) {
    if (-not $ex) { continue }
    try {
      $exFull = [System.IO.Path]::GetFullPath($ex)
      if ($full.StartsWith($exFull, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    } catch {}
  }
  # Never delete Windows / Program Files node-like paths
  if ($full -match '(?i)\\Windows\\|\\Program Files|\\$Recycle\.Bin\\') { return $true }
  return $false
}

function Add-Freed {
  param([int64]$Bytes)
  $script:FreedBytes += $Bytes
}

function Test-BudgetOk {
  return ($script:FreedBytes -lt $script:TargetBytes)
}

function Clear-Children {
  param([string]$Root, [string]$Label = 'TEMP')
  if (-not (Test-BudgetOk)) { return }
  if (-not (Test-Path -LiteralPath $Root)) { return }
  if (Test-IsExcluded -Path $Root) { return }

  if ($WhatIf) {
    $size = Get-DirSizeBytes -Path $Root
    $take = [math]::Min($size, [math]::Max([int64]0, $script:TargetBytes - $script:FreedBytes))
    Add-Freed $take
    Write-Log ("WHATIF {0} {1:N2} GB  {2}" -f $Label, ($take / 1GB), $Root) 'WHATIF'
    return
  }

  $partial = [int64]0
  Get-ChildItem -LiteralPath $Root -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (-not (Test-BudgetOk)) { return }
    try {
      $itemSize = if ($_.PSIsContainer) { Get-DirSizeBytes $_.FullName } else { [int64]$_.Length }
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
      $partial += $itemSize
      Add-Freed $itemSize
    } catch {}
  }
  if ($partial -gt 0) {
    Write-Log ("{0} cleared {1:N2} GB  {2}" -f $Label, ($partial / 1GB), $Root) 'OK'
  }
}

function Remove-NodeModulesDir {
  param([System.IO.DirectoryInfo]$Dir)
  if (-not (Test-BudgetOk)) { return }
  $path = $Dir.FullName
  if (Test-IsExcluded -Path $path) {
    Write-Log "SKIP excluded: $path" 'SKIP'
    return
  }
  if ($path -match '\\node_modules\\.+\\node_modules$') { return }

  $cutoff = $script:Cutoff
  if ($Dir.LastWriteTime -gt $cutoff) {
    Write-Log ("SKIP recent ({0:yyyy-MM-dd}): {1}" -f $Dir.LastWriteTime, $path) 'SKIP'
    return
  }

  $size = Get-DirSizeBytes -Path $path
  if ($WhatIf) {
    Add-Freed $size
    Write-Log ("WHATIF NM {0:N2} GB  {1}" -f ($size / 1GB), $path) 'WHATIF'
    return
  }

  try {
    Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
    Add-Freed $size
    Write-Log ("DELETED NM {0:N2} GB  {1}" -f ($size / 1GB), $path) 'OK'
  } catch {
    Write-Log "FAIL NM $path :: $($_.Exception.Message)" 'ERR'
  }
}

function Get-ProjectSearchRoots {
  $roots = New-Object System.Collections.Generic.List[string]
  $drives = Get-PSDrive -PSProvider FileSystem |
    Where-Object { $_.Used -ne $null -and $_.Root -match '^[A-Z]:\\$' }

  foreach ($d in $drives) {
    $r = $d.Root
    foreach ($name in @('BusineXAiLab', 'Users', 'dev', 'src', 'projects', 'code', 'repos', 'work', 'git')) {
      $p = Join-Path $r $name
      if (Test-Path -LiteralPath $p) { [void]$roots.Add($p) }
    }
    # Top-level folders on non-system data drives
    if ($d.Name -ne 'C') {
      Get-ChildItem -LiteralPath $r -Directory -Force -ErrorAction SilentlyContinue |
        Select-Object -First 40 |
        ForEach-Object { [void]$roots.Add($_.FullName) }
    }
  }

  # Current user common locations
  foreach ($p in @(
      $env:USERPROFILE,
      (Join-Path $env:USERPROFILE 'Documents'),
      (Join-Path $env:USERPROFILE 'Desktop'),
      (Join-Path $env:USERPROFILE 'source'),
      (Join-Path $env:USERPROFILE 'Projects')
    )) {
    if ($p -and (Test-Path -LiteralPath $p)) { [void]$roots.Add($p) }
  }

  return $roots | Select-Object -Unique
}

# ---- init ----
$logDir = Join-Path $env:LOCALAPPDATA 'BusineXAi\disk-cleanup'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$script:LogFile = Join-Path $logDir ('cleanup-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))
$script:TargetBytes = [int64]([math]::Round($TargetGB * 1GB))
$script:FreedBytes = [int64]0
$script:Cutoff = (Get-Date).AddDays(-1 * [math]::Abs($NodeModulesMaxAgeDays))

$beforeFree = [int64](Get-PSDrive -Name C -ErrorAction SilentlyContinue).Free

Write-Log "==== Daily disk cleanup start (target=${TargetGB} GB, node_modules older than ${NodeModulesMaxAgeDays}d) ===="
Write-Log ("C: free before: {0:N2} GB" -f ($beforeFree / 1GB))
if ($WhatIf) { Write-Log 'Running in WhatIf mode — no deletes' 'WHATIF' }

# ---- temp + caches ----
$tempRoots = @(
  $env:TEMP,
  $env:TMP,
  "$env:LOCALAPPDATA\Temp",
  'C:\Windows\Temp',
  "$env:LOCALAPPDATA\npm-cache",
  "$env:LOCALAPPDATA\pip\Cache",
  "$env:LOCALAPPDATA\Yarn\Cache",
  "$env:LOCALAPPDATA\NuGet\v3-cache",
  "$env:LOCALAPPDATA\Microsoft\Windows\INetCache",
  "$env:LOCALAPPDATA\Microsoft\Windows\DeliveryOptimization\Cache",
  "$env:USERPROFILE\.npm\_cacache",
  "$env:USERPROFILE\.cache\pip"
)

Get-PSDrive -PSProvider FileSystem |
  Where-Object { $_.Used -ne $null -and $_.Root -match '^[A-Z]:\\$' } |
  ForEach-Object {
    $tempRoots += (Join-Path $_.Root 'Temp')
  }

foreach ($t in ($tempRoots | Select-Object -Unique)) {
  if (-not (Test-BudgetOk)) { break }
  Clear-Children -Root $t -Label 'TEMP'
}

# ---- stale node_modules on all drives / project roots ----
Write-Log "Scanning project roots for node_modules older than $($script:Cutoff.ToString('yyyy-MM-dd')) ..."
$searchRoots = Get-ProjectSearchRoots
foreach ($root in $searchRoots) {
  if (-not (Test-BudgetOk)) { break }
  if (Test-IsExcluded -Path $root) {
    # Still allow scanning BusineXAiLab parent, but exclude is per node_modules path
  }
  Write-Log "Scan: $root"
  try {
    Get-ChildItem -LiteralPath $root -Directory -Recurse -Force -Filter 'node_modules' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch '\\node_modules\\.+\\node_modules$' } |
      ForEach-Object {
        if (-not (Test-BudgetOk)) { return }
        Remove-NodeModulesDir -Dir $_
      }
  } catch {
    Write-Log "Scan error $root :: $($_.Exception.Message)" 'ERR'
  }
}

# ---- recycle bin ----
if (-not $WhatIf -and (Test-BudgetOk)) {
  try {
    Clear-RecycleBin -Force -ErrorAction Stop
    Write-Log 'Recycle Bin cleared' 'OK'
  } catch {
    Write-Log "Recycle Bin skip: $($_.Exception.Message)" 'SKIP'
  }
}

$afterFree = [int64](Get-PSDrive -Name C -ErrorAction SilentlyContinue).Free
Write-Log ("Estimated reclaimed this run: {0:N2} GB" -f ($script:FreedBytes / 1GB))
Write-Log ("C: free after: {0:N2} GB (measured delta {1:N2} GB)" -f ($afterFree / 1GB), (($afterFree - $beforeFree) / 1GB))
Write-Log '==== Daily disk cleanup done ===='

Get-ChildItem $logDir -Filter 'cleanup-*.log' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  Remove-Item -Force -ErrorAction SilentlyContinue

exit 0
