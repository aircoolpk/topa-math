param(
  [switch]$ForceStopPort3000
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WebRoot = Join-Path $ProjectRoot 'apps\web'
$PortableNode = Join-Path $ProjectRoot '.tools\node-v20.20.2-win-x64'
$NextDir = Join-Path $WebRoot '.next'

$summary = [ordered]@{
  Port3000Check = 'NOT RUN'
  StopDevServer = 'NOT REQUESTED'
  NodeRuntime = 'NOT RUN'
  CleanNext = 'NOT RUN'
  Lint = 'NOT RUN'
  Build = 'NOT RUN'
}

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-Port3000ProcessIds {
  $lines = & netstat -ano | Select-String ':3000'
  $ids = @()
  foreach ($line in $lines) {
    $parts = ($line.Line -replace '^\s+', '') -split '\s+'
    if ($parts.Count -ge 5 -and $parts[1] -match '(^|:|\])3000$') {
      $pidText = $parts[-1]
      if ($pidText -match '^\d+$' -and $pidText -ne '0') {
        $ids += [int]$pidText
      }
    }
  }
  $ids | Sort-Object -Unique
}

function Show-Port3000Processes {
  param([int[]]$ProcessIds)
  foreach ($id in $ProcessIds) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    if ($proc) {
      [pscustomobject]@{
        PID = $proc.ProcessId
        Name = $proc.Name
        CommandLine = $proc.CommandLine
      }
    }
  }
}

Write-Host '4-Craft web validation (Windows safe mode)' -ForegroundColor Green
Write-Host 'Reminder: stop the Next dev server before lint/build. The live dev server can lock or mutate .next on Windows.'
Write-Host 'Use -ForceStopPort3000 to stop processes listening on port 3000 automatically.'

Write-Step 'Checking port 3000'
$portPids = @(Get-Port3000ProcessIds)
if ($portPids.Count -gt 0) {
  $summary.Port3000Check = "BUSY ($($portPids -join ', '))"
  Write-Warning "Port 3000 is in use by PID(s): $($portPids -join ', ')"
  Show-Port3000Processes -ProcessIds $portPids | Format-Table -AutoSize -Wrap

  if (-not $ForceStopPort3000) {
    $summary.StopDevServer = 'SKIPPED'
    Write-Host ''
    Write-Host 'FAIL: Port 3000 is busy. Re-run with -ForceStopPort3000 or stop the dev server manually, then run this script again.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Summary:' -ForegroundColor Cyan
    foreach ($item in $summary.GetEnumerator()) {
      Write-Host ("- {0}: {1}" -f $item.Key, $item.Value)
    }
    exit 2
  }

  Write-Step 'Stopping port 3000 processes'
  foreach ($id in $portPids) {
    Write-Host "Stopping PID $id"
    & taskkill /PID $id /F | Out-Host
  }
  Start-Sleep -Seconds 2
  $remaining = @(Get-Port3000ProcessIds)
  if ($remaining.Count -gt 0) {
    $summary.StopDevServer = "FAIL (still busy: $($remaining -join ', '))"
    throw "Port 3000 is still in use after forced stop."
  }
  $summary.StopDevServer = 'PASS'
} else {
  $summary.Port3000Check = 'FREE'
  Write-Host 'Port 3000 is free.'
}

Write-Step 'Selecting Node runtime'
if ((Test-Path -LiteralPath (Join-Path $PortableNode 'node.exe')) -and (Test-Path -LiteralPath (Join-Path $PortableNode 'npm.cmd'))) {
  $env:PATH = "$PortableNode;$env:PATH"
  $summary.NodeRuntime = "PASS portable Node ($PortableNode)"
} else {
  Write-Warning "Portable Node 20 was not found at $PortableNode. Falling back to node/npm on PATH."
  $summary.NodeRuntime = 'WARN using PATH'
}

$nodeVersion = (& node -v).Trim()
$npmVersion = (& npm -v).Trim()
Write-Host "node: $nodeVersion"
Write-Host "npm:  $npmVersion"

Push-Location $WebRoot
try {
  Write-Step 'Removing .next'
  if (Test-Path -LiteralPath $NextDir) {
    Remove-Item -LiteralPath $NextDir -Recurse -Force
    Write-Host 'Removed .next.'
  } else {
    Write-Host '.next was already absent.'
  }
  $summary.CleanNext = 'PASS'

  Write-Step 'Running npm run lint'
  & npm run lint
  if ($LASTEXITCODE -ne 0) {
    $summary.Lint = "FAIL ($LASTEXITCODE)"
    throw "npm run lint failed with exit code $LASTEXITCODE"
  }
  $summary.Lint = 'PASS'

  Write-Step 'Running npm run build'
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    $summary.Build = "FAIL ($LASTEXITCODE)"
    throw "npm run build failed with exit code $LASTEXITCODE"
  }
  $summary.Build = 'PASS'
}
finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Summary:' -ForegroundColor Cyan
foreach ($item in $summary.GetEnumerator()) {
  Write-Host ("- {0}: {1}" -f $item.Key, $item.Value)
}

if ($summary.Lint -eq 'PASS' -and $summary.Build -eq 'PASS') {
  Write-Host ''
  Write-Host 'PASS: Web validation completed successfully.' -ForegroundColor Green
  exit 0
}

Write-Host ''
Write-Host 'FAIL: Web validation did not complete successfully.' -ForegroundColor Red
exit 1
