# Run from the original PowerShell session. Never prints key/error contents.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [System.Security.SecureString]$ApiKey,
    # Test fixtures only; cannot redirect normal imports to another secret file.
    [string]$TestFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = 'C:\web-app\4-craft.com'
$secretFile = Join-Path $root '.env.mpp-staging'
$temporaryFile = $null
$pointer = [IntPtr]::Zero
$plain = $null
$stage = 'ValidatePlatform'
$committed = $false
$cleanupFailed = $false
$failure = $null

function Set-RestrictedDacl {
    param([string]$Path, [Security.Principal.SecurityIdentifier[]]$Allowed)
    $currentAcl = Get-Acl -LiteralPath $Path
    $ownerSid = $currentAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($ownerSid -notin @($Allowed | ForEach-Object { $_.Value })) {
        throw [UnauthorizedAccessException]::new('Untrusted file owner')
    }
    # No owner/group/SACL fields: persist ONLY modified access-control sections.
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in $Allowed) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $sid, [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    if ($PSVersionTable.PSVersion.Major -le 5) {
        [IO.File]::SetAccessControl($Path, $acl)
    } else {
        [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($Path), $acl)
    }
    Assert-RestrictedDacl -Path $Path -Allowed $Allowed -OwnerSid $ownerSid
}

function Assert-RestrictedDacl {
    param([string]$Path, [Security.Principal.SecurityIdentifier[]]$Allowed, [string]$OwnerSid)
    $acl = Get-Acl -LiteralPath $Path
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    $sids = @($Allowed | ForEach-Object { $_.Value })
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $OwnerSid -or $rules.Count -ne $sids.Count) {
        throw [UnauthorizedAccessException]::new('ACL verification failed')
    }
    foreach ($rule in $rules) {
        if ($rule.IsInherited -or $rule.IdentityReference.Value -notin $sids -or $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) {
            throw [UnauthorizedAccessException]::new('ACL verification failed')
        }
    }
}

try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw [PlatformNotSupportedException]::new()
    }
    $stage = 'ValidateTarget'
    if ($TestFile) {
        $testRoot = [IO.Path]::GetFullPath((Join-Path $root '.tools\mpp-key-helper-tests')) + '\'
        $candidate = [IO.Path]::GetFullPath($TestFile)
        if (-not $candidate.StartsWith($testRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($candidate) -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.env$') {
            throw [ArgumentException]::new('Test fixture path refused')
        }
        $secretFile = $candidate
    }
    if (-not (Test-Path -LiteralPath $secretFile -PathType Leaf)) {
        throw [IO.FileNotFoundException]::new('Existing target required')
    }
    $item = Get-Item -LiteralPath $secretFile
    while ($item) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw [UnauthorizedAccessException]::new('Reparse point refused')
        }
        if ($item.FullName.TrimEnd('\') -eq $root.TrimEnd('\')) { break }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory }
        else { $item = $item.Parent }
        if (-not $item) { throw [UnauthorizedAccessException]::new('Project containment failed') }
    }
    if ($TestFile -and 'TOPA_DUMMY_FIXTURE=1' -notin [IO.File]::ReadAllLines($secretFile)) {
        throw [ArgumentException]::new('Missing dummy fixture marker')
    }

    $stage = 'ValidateKey'
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ApiKey)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($plain) -or $plain -match "[\r\n\x00']") {
        throw [ArgumentException]::new('Unsupported single-line key representation')
    }
    $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User,
        [Security.Principal.SecurityIdentifier]::new('S-1-5-18'),
        [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    $stage = 'ProtectTargetAcl'
    Set-RestrictedDacl -Path $secretFile -Allowed $allowed
    $originalOwner = (Get-Acl -LiteralPath $secretFile).GetOwner([Security.Principal.SecurityIdentifier]).Value

    $stage = 'ReadEnvironment'
    $lines = [Collections.Generic.List[string]]::new()
    $replaced = $false
    foreach ($line in [IO.File]::ReadAllLines($secretFile)) {
        if ($line -match '^\s*(?:export\s+)?MPP_PROJECT_API_KEY\s*=') {
            if (-not $replaced) { $lines.Add("MPP_PROJECT_API_KEY='$plain'"); $replaced = $true }
        } else { $lines.Add($line) }
    }
    if (-not $replaced) { $lines.Add("MPP_PROJECT_API_KEY='$plain'") }

    $stage = 'CreateTemporary'
    $temporaryFile = $secretFile + '.key-import.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    $stream = [IO.File]::Open($temporaryFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $stream.Dispose()
    $stage = 'ProtectTemporaryAcl'
    Set-RestrictedDacl -Path $temporaryFile -Allowed $allowed
    $stage = 'WriteTemporary'
    [IO.File]::WriteAllLines($temporaryFile, $lines, [Text.UTF8Encoding]::new($false))
    $stage = 'AtomicReplace'
    # PowerShell $null can bind as an EMPTY backup filename. NullString is real null.
    [IO.File]::Replace($temporaryFile, $secretFile, [System.Management.Automation.Language.NullString]::Value)
    $committed = $true
    $temporaryFile = $null
    $stage = 'VerifyCommit'
    Assert-RestrictedDacl -Path $secretFile -Allowed $allowed -OwnerSid $originalOwner
    $actual = [IO.File]::ReadAllLines($secretFile)
    if ($actual.Count -ne $lines.Count) { throw [IO.InvalidDataException]::new('Commit verification failed') }
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($actual[$index] -cne $lines[$index]) { throw [IO.InvalidDataException]::new('Commit verification failed') }
    }
} catch {
    # Retain only safe metadata, never the original message, values, or inner error.
    $exception = $_.Exception
    while ($exception.InnerException) { $exception = $exception.InnerException }
    $code = $exception.HResult -band 65535
    $category = [Management.Automation.ErrorCategory]::WriteError
    if ($exception -is [UnauthorizedAccessException] -or $exception -is [Security.SecurityException]) { $category = [Management.Automation.ErrorCategory]::PermissionDenied }
    elseif ($exception -is [ArgumentException]) { $category = [Management.Automation.ErrorCategory]::InvalidArgument }
    elseif ($exception -is [IO.FileNotFoundException] -or $exception -is [IO.DirectoryNotFoundException]) { $category = [Management.Automation.ErrorCategory]::ObjectNotFound }
    elseif ($exception -is [IO.IOException] -and $code -in @(32, 33)) { $category = [Management.Automation.ErrorCategory]::ResourceBusy }
    $failure = @{ Stage = $stage; Category = $category; Type = $exception.GetType().Name; Code = $code }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $plain = $null
    if ($temporaryFile) {
        try { if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction Stop } }
        catch { $cleanupFailed = $true }
    }
}

if ($failure -or $cleanupFailed) {
    if (-not $failure) { $failure = @{ Stage = 'CleanupTemporary'; Category = [Management.Automation.ErrorCategory]::WriteError; Type = 'IOException'; Code = 0 } }
    $message = 'TOPA key import failed: Stage={0}; Category={1}; Type={2}; Code={3}; WriteCommitted={4}; CleanupFailed={5}. No secret details emitted.' -f $failure.Stage, $failure.Category, $failure.Type, $failure.Code, $committed, $cleanupFailed
    $safeError = [Management.Automation.ErrorRecord]::new([InvalidOperationException]::new($message), ('TopaMppKeyImport.' + $failure.Stage), $failure.Category, $null)
    $PSCmdlet.ThrowTerminatingError($safeError)
}
Write-Output 'MPP_PROJECT_API_KEY_PRESENT=True'
Write-Output 'STAGING_SECRET_ACL_RESTRICTED=True'
