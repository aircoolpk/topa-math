# Clean Mini Quiz Audit
$ErrorActionPreference = "Continue"
$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math"
$docsPath = "D:\web app\4-craft.com\docs"

Add-Type -AssemblyName System.Web.Extensions

function Parse-Json {
    param([string]$JsonText)
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    return $serializer.DeserializeObject($JsonText)
}

# Get all JSON files excluding known non-content files
$jsonFiles = Get-ChildItem -Path $mathPath -Filter "*.json" -Recurse -File | Where-Object { 
    $_.Name -notmatch "QUESTION|LESSON_CONTENT|check|decode|fix|debug|export|analyze|validate" 
}

$issues = @()

foreach ($file in $jsonFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $j = Parse-Json -JsonText $content
        
        # Check top-level mini_quiz
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
        
        # Check lesson_variants
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
        Write-Host "Error parsing $($file.Name): $_"
    }
}

# Summary
$missingBoth = ($issues | Where-Object { $_.IssueType -eq "missing_both" }).Count
$answerOnly = ($issues | Where-Object { $_.IssueType -eq "answer_only" }).Count

Write-Host ""
Write-Host "=== AUDIT SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total issues: $($issues.Count)"
Write-Host "Missing correct_answer AND answer: $missingBoth"
Write-Host "Has answer but missing correct_answer: $answerOnly"

Write-Host ""
Write-Host "Issues by file:"
$issues | Group-Object File | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) issues"
}

# Save to CSV properly
$issues | Export-Csv -Path "$docsPath\mini_quiz_issues.csv" -NoTypeInformation -Encoding UTF8

# Show details
Write-Host ""
Write-Host "=== DETAILS ===" -ForegroundColor Yellow
foreach ($issue in $issues) {
    Write-Host "$($issue.File) | $($issue.Location) | Q: $($issue.Question)... | $($issue.IssueType) | choices:$($issue.HasChoices)"
}

Write-Host ""
Write-Host "CSV saved to: $docsPath\mini_quiz_issues.csv"