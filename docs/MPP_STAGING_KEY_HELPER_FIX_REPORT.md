# MPP Staging Key Helper Repair

Date: 2026-10-15. Only TOPA source and isolated dummy fixtures were used.

## Reproduced Root Causes

The ORIGINAL helper was executed against separate dummy env files using an
in-memory path-substituted copy. Its catch was replaced in that reproduction
only to output exception types/category/line/HResult, never messages or values.
No real secret file or existing PowerShell key variable was accessed.

1. First import reached original line 67, File.Replace(..., $null), then raised
   MethodInvocationException -> ArgumentException, HResult -2147024809, in both
   Windows PowerShell 5.1 and PowerShell 7. PowerShell's string binding of plain
   $null is not a reliable actual-null backup filename for this overload.
2. Repeated import of the already protected dummy target failed at original
   line 45, Set-Acl, with PrivilegeNotHeldException / PermissionDenied / code 5
   in BOTH engines, even though the fixture owner matched the current user.
   Thus elevation/ownership changes are not an appropriate blanket repair.
3. The old catch discarded both actionable failure paths. These are reproduced
   helper faults; without the user's original unmasked error, this report does
   not pretend to know which one their particular invocation encountered first.

## Changes

- scripts/Set-TopaMppStagingKey.ps1 now constructs a DACL-only FileSecurity object,
  without setting Owner/Group/SACL. It avoids the problematic Set-Acl provider
  path: File.SetAccessControl on Windows PowerShell 5.1; FileSystemAclExtensions
  on PowerShell 7. Existing trusted ownership/group is preserved and verified.
- Atomic replacement passes System.Management.Automation.Language.NullString.Value
  as an ACTUAL null backup filename. No plaintext backup and no non-atomic
  delete/copy fallback are used. Temp data is on the same directory/volume.
- Target and temporary file DACLs are restricted/verified before secret writes:
  current Windows user, SYSTEM and Administrators only, no inherited access.
- Untrusted ownership, reparse points, missing files and invalid dotenv input
  fail closed; the helper never silently takes ownership or requests elevation.
- Errors include only Stage, Category, exception TYPE, numeric Code,
  WriteCommitted and CleanupFailed. Original exception messages/inner records,
  key contents and env lines are never attached to the emitted error.
- Temporary-file cleanup errors are sanitized too. If WriteCommitted=True,
  replacement already occurred: do not assume the old key remains or retry blindly.
- A constrained -TestFile option accepts only marked dummy fixtures beneath
  .tools/mpp-key-helper-tests. Normal imports still use the original fixed target.
  Invalid test paths are rejected before file access. The option does not allow
  selection of another project/production secret file.
- scripts/Test-TopaMppStagingKey.ps1 provides repeatable dummy-only regression
  coverage. Its generated fixtures are gitignored and never sent to any API.

## Executed Tests

Windows PowerShell **5.1.26100.9444: 10 passed**.
PowerShell **7.6.5: 10 passed**.

Cases: import/duplicate collapse/other-variable preservation/ACL/owner/group/atomic
commit; repeated import without ownership privilege; missing-key append; invalid
key redaction; path containment; required dummy marker; locked-target atomic
failure preserving original bytes plus temp cleanup; read-only permission error;
injected ACL exception whose message includes a dummy secret but is sanitized;
absence of temp/backup secret artifacts after tests.

```powershell
powershell.exe -NoProfile -NonInteractive -File 'C:\web-app\4-craft.com\scripts\Test-TopaMppStagingKey.ps1'
pwsh.exe -NoProfile -NonInteractive -File 'C:\web-app\4-craft.com\scripts\Test-TopaMppStagingKey.ps1'
```

The tests were actual helper executions, not syntax-only checks. Tests ran only
on isolated local Windows files; other filesystems are not claimed validated.
No real key was read/imported, no real staging env content was read, and no
Docker/restart/deployment/production operation was performed. The obsolete
scratch reproduction script was removed so it cannot accidentally be reused
against the changed helper. Production and the real secret file were untouched.

File ACLs are not an encrypted vault and do not prevent a trusted administrator
or a process running as the same user from accessing secrets. Parent-directory
security is also part of the machine's security boundary; project-wide permissions
were not changed by this repair.

## Retry With The Original Session

In the SAME PowerShell process containing the existing string $apiKey, run:

```powershell
& 'C:\web-app\4-craft.com\scripts\Set-TopaMppStagingKey.ps1' -ApiKey (ConvertTo-SecureString -String $apiKey -AsPlainText -Force)
```

Do not add -TestFile for a real import, do not paste the actual key into the
command, and do not launch another powershell.exe expecting it to inherit the
local $apiKey variable. No administrator elevation is required by design; an
actual denial should be investigated from its sanitized Stage/Category/Code.

Success prints only MPP_PROJECT_API_KEY_PRESENT=True and
STAGING_SECRET_ACL_RESTRICTED=True. If it fails, share ONLY the sanitized error
fields, never the key, env file, $Error dump or raw traced variables. The key is
not created or rotated. Importing it does not refresh a Docker container, enable
payments or prove merchant/project ownership or payment success.
