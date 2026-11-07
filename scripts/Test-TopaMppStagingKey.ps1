# Standalone Windows PowerShell 5.1/PowerShell 7 regression tests. Dummy data only.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = 'C:\web-app\4-craft.com'
$helper = Join-Path $root 'scripts\Set-TopaMppStagingKey.ps1'
$directory = Join-Path $root '.tools\mpp-key-helper-tests'
$null = New-Item -Path $directory -ItemType Directory -Force
$prefix = 'regression-' + $PSVersionTable.PSVersion.Major + '-' + [Guid]::NewGuid().ToString('N')
$dummy = 'D' * 52
$secure = ConvertTo-SecureString -String $dummy -AsPlainText -Force
$passed = [Collections.Generic.List[string]]::new()

function New-Fixture {
    param([string]$Name, [string[]]$Lines = @('TOPA_DUMMY_FIXTURE=1', 'OTHER_SETTING=preserved', 'MPP_PROJECT_API_KEY='))
    $file = Join-Path $directory ($prefix + '-' + $Name + '.env')
    [IO.File]::WriteAllLines($file, $Lines, [Text.UTF8Encoding]::new($false))
    return $file
}
function Assert-Test {
    param([bool]$Condition, [string]$Name)
    if (-not $Condition) { throw ('Dummy-only regression failed: ' + $Name) }
}
function Invoke-ExpectedFailure {
    param([string]$Path, [System.Security.SecureString]$Key = $secure)
    try { $null = & $helper -ApiKey $Key -TestFile $Path }
    catch { return $_ }
    throw 'Expected a controlled failure'
}
function Assert-SafeError {
    param($Record, [string]$Stage, [string]$Category)
    Assert-Test ($Record.Exception.Message.Contains('Stage=' + $Stage)) 'error step'
    Assert-Test ([string]$Record.CategoryInfo.Category -eq $Category) 'error category'
    Assert-Test (-not $Record.Exception.ToString().Contains($dummy)) 'exception redaction'
    Assert-Test (-not ($Record | Out-String).Contains($dummy)) 'formatted error redaction'
    Assert-Test ($Record.Exception.Message.Contains('WriteCommitted=False')) 'uncommitted failure'
}

try {
    $file = New-Fixture 'success' @('TOPA_DUMMY_FIXTURE=1', 'OTHER_SETTING=preserved', 'MPP_PROJECT_API_KEY=old-dummy', 'MPP_PROJECT_API_KEY=duplicate-dummy')
    $owner = (Get-Acl -LiteralPath $file).GetOwner([Security.Principal.SecurityIdentifier]).Value
    $group = (Get-Acl -LiteralPath $file).GetGroup([Security.Principal.SecurityIdentifier]).Value
    $result = @(& $helper -ApiKey $secure -TestFile $file)
    Assert-Test ($result.Count -eq 2) 'success output count'
    Assert-Test ($result[0] -ceq 'MPP_PROJECT_API_KEY_PRESENT=True') 'success presence only'
    $lines = [IO.File]::ReadAllLines($file)
    Assert-Test (@($lines | Where-Object { $_ -match '^MPP_PROJECT_API_KEY=' }).Count -eq 1) 'duplicate collapse'
    Assert-Test ($lines -contains ("MPP_PROJECT_API_KEY='" + $dummy + "'")) 'dummy import integrity'
    Assert-Test ($lines -contains 'OTHER_SETTING=preserved') 'other env preserved'
    $acl = Get-Acl -LiteralPath $file
    Assert-Test ($acl.AreAccessRulesProtected) 'protected DACL'
    Assert-Test ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $owner) 'ownership preserved'
    Assert-Test ($acl.GetGroup([Security.Principal.SecurityIdentifier]).Value -eq $group) 'group preserved'
    Assert-Test (@($acl.Access).Count -eq 3) 'exact ACL allowlist'
    $passed.Add('import_duplicate_preservation_acl_owner_atomic_replace')

    $null = & $helper -ApiKey $secure -TestFile $file
    $null = & $helper -ApiKey $secure -TestFile $file
    $passed.Add('repeated_import_without_ownership_privilege')

    $append = New-Fixture 'append' @('TOPA_DUMMY_FIXTURE=1', 'OTHER_SETTING=preserved')
    $null = & $helper -ApiKey $secure -TestFile $append
    Assert-Test ([IO.File]::ReadAllLines($append) -contains ("MPP_PROJECT_API_KEY='" + $dummy + "'")) 'append missing key'
    $passed.Add('append_missing_key')

    $invalid = ConvertTo-SecureString -String ($dummy + "'") -AsPlainText -Force
    try { $errorRecord = Invoke-ExpectedFailure -Path $file -Key $invalid }
    finally { $invalid.Dispose() }
    Assert-SafeError $errorRecord 'ValidateKey' 'InvalidArgument'
    $passed.Add('invalid_input_redacted')

    $errorRecord = Invoke-ExpectedFailure -Path (Join-Path $root '.tools\refused-test.env')
    Assert-SafeError $errorRecord 'ValidateTarget' 'InvalidArgument'
    $passed.Add('test_path_containment')

    $unmarked = New-Fixture 'unmarked' @('OTHER_SETTING=preserved')
    $errorRecord = Invoke-ExpectedFailure -Path $unmarked
    Assert-SafeError $errorRecord 'ValidateTarget' 'InvalidArgument'
    $passed.Add('test_marker_required')

    $locked = New-Fixture 'locked'
    $before = [IO.File]::ReadAllText($locked)
    $handle = [IO.File]::Open($locked, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try { $errorRecord = Invoke-ExpectedFailure -Path $locked }
    finally { $handle.Dispose() }
    Assert-SafeError $errorRecord 'AtomicReplace' 'ResourceBusy'
    Assert-Test ([IO.File]::ReadAllText($locked) -ceq $before) 'atomic failure preserves original'
    Assert-Test (@(Get-ChildItem -LiteralPath $directory -Filter ([IO.Path]::GetFileName($locked) + '.key-import.*.tmp')).Count -eq 0) 'failed temp cleanup'
    $passed.Add('atomic_lock_failure_original_preserved_cleanup_redacted')

    $readOnly = New-Fixture 'readonly'
    [IO.File]::SetAttributes($readOnly, [IO.FileAttributes]::ReadOnly)
    try { $errorRecord = Invoke-ExpectedFailure -Path $readOnly }
    finally { [IO.File]::SetAttributes($readOnly, [IO.FileAttributes]::Normal) }
    Assert-SafeError $errorRecord 'AtomicReplace' 'PermissionDenied'
    $passed.Add('readonly_permission_failure_redacted')

    $denied = New-Fixture 'injected-acl-error'
    function Invoke-InjectedAclError {
        function Get-Acl { param($LiteralPath); throw [UnauthorizedAccessException]::new($dummy) }
        return Invoke-ExpectedFailure -Path $denied
    }
    $errorRecord = Invoke-InjectedAclError
    Assert-SafeError $errorRecord 'ProtectTargetAcl' 'PermissionDenied'
    $passed.Add('acl_error_with_secret_message_is_sanitized')

    Assert-Test (@(Get-ChildItem -LiteralPath $directory -Filter ($prefix + '*.key-import.*.tmp')).Count -eq 0) 'no temp secret artifacts'
    $passed.Add('no_plaintext_backup_or_temp_artifacts')
    [pscustomobject]@{ Engine = $PSVersionTable.PSVersion.ToString(); Passed = $passed.Count; Cases = @($passed); RealKeyRead = $false; RealEnvFileRead = $false } | ConvertTo-Json -Depth 3
} finally {
    $secure.Dispose()
}
