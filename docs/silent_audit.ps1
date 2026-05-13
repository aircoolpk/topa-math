# Silent Mini Quiz Audit - output to file only
$ErrorActionPreference = "SilentlyContinue"
$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math"
$docsPath = "D:\web app\4-craft.com\docs"
$logFile = "$docsPath\audit_log.txt"

$log = ""

function Log {
    param([string]$Msg)
    $script:log += $Msg + "`n"
}

Add-Type -AssemblyName System.Web.Extensions

function Parse-Json {
    param([string]$JsonText)
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    return $serializer.DeserializeObject($JsonText)
}

$jsonFiles = Get-ChildItem -Path $mathPath -Filter "*.json" -Recurse -File | Where-Object { 
    $_.Name -notmatch "QUESTION|LESSON_CONTENT|check|decode|fix|debug|export|analyze|validate" 
}

$issues = @()

foreach ($file in $jsonFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $j = Parse-Json -JsonText $content
        
        if ($j.mini_quiz -and $j.mini_quiz.questions) {
            foreach ($q in $j.mini_quiz.questions) {
                $issueType = ""
                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                    $issueType = if ($null -ne $q.answer -and $q.answer -ne "") { "answer_only" } else { "missing_both" }
                }
                if ($issueType) {
                    $issues += [PSCustomObject]@{
                        File = $file.Name
                        Location = "top-level"
                        Question = if ($q.text_th) { $q.text_th.Substring(0, [Math]::Min(25, $q.text_th.Length)) } else { "NO_TEXT" }
                        IssueType = $issueType
                        HasChoices = ($null -ne $q.choices -and $q.choices -is [Array] -and $q.choices.Count -gt 0)
                    }
                }
            }
        }
        
        if ($j.lesson_variants) {
            foreach ($variant in $j.lesson_variants) {
                $variantId = if ($variant.variant_id) { $variant.variant_id } else { "unknown" }
                if ($variant.visual_blocks) {
                    foreach ($block in $variant.visual_blocks) {
                        if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                            foreach ($q in $block.data.questions) {
                                $issueType = ""
                                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                                    $issueType = if ($null -ne $q.answer -and $q.answer -ne "") { "answer_only" } else { "missing_both" }
                                }
                                if ($issueType) {
                                    $issues += [PSCustomObject]@{
                                        File = $file.Name
                                        Location = "variant#$($variantId)"
                                        Question = if ($q.text_th) { $q.text_th.Substring(0, [Math]::Min(25, $q.text_th.Length)) } else { "NO_TEXT" }
                                        IssueType = $issueType
                                        HasChoices = ($null -ne $q.choices -and $q.choices -is [Array] -and $q.choices.Count -gt 0)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch {
        Log "Error parsing $($file.Name): $_"
    }
}

$missingBoth = ($issues | Where-Object { $_.IssueType -eq "missing_both" }).Count
$answerOnly = ($issues | Where-Object { $_.IssueType -eq "answer_only" }).Count

Log "=== AUDIT SUMMARY ==="
Log "Total issues: $($issues.Count)"
Log "Missing correct_answer AND answer: $missingBoth"
Log "Has answer but missing correct_answer: $answerOnly"

$issues | Export-Csv -Path "$docsPath\mini_quiz_issues.csv" -NoTypeInformation -Encoding UTF8

Log ""
Log "Issues by file:"
$issues | Group-Object File | ForEach-Object {
    Log "  $($_.Name): $($_.Count) issues"
}

Log ""
Log "=== ALL ISSUES ==="
foreach ($issue in $issues) {
    Log "$($issue.File) | $($issue.Location) | Q: $($issue.Question)... | $($issue.IssueType) | choices:$($issue.HasChoices)"
}

$log | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "Audit complete. See $logFile"