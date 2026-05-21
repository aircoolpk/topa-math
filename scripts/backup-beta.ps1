param(
    [switch]$IncludeLocalDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\web-app\4-craft.com"
$BackupRoot = "C:\web-app\4-craft-backups"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project root not found: $ProjectRoot"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "4-craft-beta-$timestamp"
$stagingRoot = Join-Path $BackupRoot ".staging-$backupName"
$zipPath = Join-Path $BackupRoot "$backupName.zip"

$excludedDirectoryNames = @(
    ".git",
    ".hermes",
    ".tools",
    ".next",
    ".venv",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "__pycache__",
    "node_modules",
    "cache",
    "logs"
)

$excludedFileNames = @(
    ".env",
    "tsconfig.tsbuildinfo"
)

$excludedFilePatterns = @(
    ".env.*",
    "*.log",
    "*.tmp",
    "*.temp",
    "*.cache",
    "*.pyc",
    "*.pyo",
    "~*",
    "temp_*",
    "debug_*.log"
)

function Test-IsExcluded {
    param([System.IO.FileSystemInfo]$Item)

    if ($Item.PSIsContainer -and $excludedDirectoryNames -contains $Item.Name) {
        return $true
    }

    if (-not $Item.PSIsContainer) {
        if ($excludedFileNames -contains $Item.Name) {
            return $true
        }
        foreach ($pattern in $excludedFilePatterns) {
            if ($Item.Name -like $pattern) {
                return $true
            }
        }
    }

    foreach ($part in ($Item.FullName.Substring($ProjectRoot.Length).TrimStart("\") -split "[\\/]")) {
        if ($excludedDirectoryNames -contains $part) {
            return $true
        }
    }

    return $false
}

function Copy-SafeTree {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $source = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source)) {
        return
    }

    $destination = Join-Path $stagingRoot $RelativePath
    $sourceItem = Get-Item -LiteralPath $source

    if (-not $sourceItem.PSIsContainer) {
        if (Test-IsExcluded $sourceItem) {
            return
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
        return
    }

    Get-ChildItem -LiteralPath $source -Recurse -Force | ForEach-Object {
        if (Test-IsExcluded $_) {
            return
        }
        $relativeToProject = $_.FullName.Substring($ProjectRoot.Length).TrimStart("\")
        $target = Join-Path $stagingRoot $relativeToProject
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        } else {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        }
    }
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

$includePaths = @(
    "apps\api\app",
    "apps\api\alembic",
    "apps\web\src",
    "docs",
    "scripts\backup-beta.ps1",
    "package.json",
    "README.md",
    "AGENTS.md",
    ".gitignore",
    "apps\api\pyproject.toml",
    "apps\api\alembic.ini",
    "apps\api\Dockerfile",
    "apps\web\package.json",
    "apps\web\package-lock.json",
    "apps\web\next.config.js",
    "apps\web\postcss.config.js",
    "apps\web\tailwind.config.ts",
    "apps\web\tsconfig.json",
    "apps\web\README.md",
    "infra\docker-compose.yml"
)

foreach ($path in $includePaths) {
    Copy-SafeTree -RelativePath $path
}

$databaseSource = Join-Path $ProjectRoot "apps\api\adaptive_learning.db"
if ($IncludeLocalDatabase -and (Test-Path -LiteralPath $databaseSource -PathType Leaf)) {
    $databaseTarget = Join-Path $stagingRoot "apps\api\adaptive_learning.db"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $databaseTarget) | Out-Null
    Copy-Item -LiteralPath $databaseSource -Destination $databaseTarget -Force
}

$forbidden = Get-ChildItem -LiteralPath $stagingRoot -Recurse -Force -File | Where-Object {
    $_.Name -eq ".env" -or
    $_.Name -like ".env.*" -or
    $_.FullName -match "\\node_modules\\|\\.next\\|\\.venv\\|\\__pycache__\\|\\logs\\|\\cache\\"
}

if ($forbidden) {
    $forbiddenList = ($forbidden | ForEach-Object { $_.FullName }) -join "`n"
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    throw "Backup staging contains forbidden files:`n$forbiddenList"
}

$manifestPath = Join-Path $stagingRoot "BACKUP_MANIFEST.txt"
$manifest = @(
    "4-Craft closed Beta backup",
    "Created: $(Get-Date -Format o)",
    "Project root: $ProjectRoot",
    "Included local database: $IncludeLocalDatabase",
    "",
    "Excluded: node_modules, .next, .venv, __pycache__, logs, cache, .env, .env.*, temporary files",
    "",
    "Files:"
)
$fileList = Get-ChildItem -LiteralPath $stagingRoot -Recurse -Force -File |
    Sort-Object FullName |
    ForEach-Object { $_.FullName.Substring($stagingRoot.Length).TrimStart("\") }
Set-Content -LiteralPath $manifestPath -Value ($manifest + $fileList) -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host "Backup created: $zipPath"
