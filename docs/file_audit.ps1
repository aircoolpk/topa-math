# Minimal audit - file output only
$ErrorActionPreference = "SilentlyContinue"
$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math"
$docsPath = "D:\web app\4-craft.com\docs"

Add-Type -AssemblyName System.Web.Extensions

function Parse-Json {
    param([string]$JsonText)
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    return $serializer.DeserializeObject($JsonText)
}

$results = @()

# Get content JSON files only
$jsonFiles = Get-ChildItem -Path $mathPath -Filter "*.json" -Recurse -File | Where-Object { 
    $_.Name -notmatch "QUESTION|LESSON_CONTENT|check|decode|fix|debug|export|analyze|validate" 
}

foreach ($file in $jsonFiles) {
    $content = ""
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $j = Parse-Json -JsonText $content
        
        # Count issues per file
        $fileIssues = 0
        $missingBoth = 0
        $answerOnly = 0
        
        # Check top-level mini_quiz
        if ($j.mini_quiz -and $j.mini_quiz.questions) {
            foreach ($q in $j.mini_quiz.questions) {
                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                    $fileIssues++
                    if ($null -ne $q.answer -and $q.answer -ne "") { $answerOnly++ } else { $missingBoth++ }
                }
            }
        }
        
        # Check lesson_variants
        if ($j.lesson_variants) {
            foreach ($variant in $j.lesson_variants) {
                if ($variant.visual_blocks) {
                    foreach ($block in $variant.visual_blocks) {
                        if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                            foreach ($q in $block.data.questions) {
                                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                                    $fileIssues++
                                    if ($null -ne $q.answer -and $q.answer -ne "") { $answerOnly++ } else { $missingBoth++ }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        if ($fileIssues -gt 0) {
            $results += [PSCustomObject]@{
                File = $file.Name
                MissingBoth = $missingBoth
                AnswerOnly = $answerOnly
                Total = $fileIssues
            }
        }
    } catch {
        $results += [PSCustomObject]@{
            File = $file.Name
            MissingBoth = -1
            AnswerOnly = -1
            Total = -1
            Error = $_.Exception.Message.Substring(0, [Math]::Min(100, $_.Exception.Message.Length))
        }
    }
}

$results | Export-Csv -Path "$docsPath\file_issues.csv" -NoTypeInformation -Encoding UTF8
$totalMissing = ($results | Where-Object { $_.MissingBoth -gt 0 } | Measure-Object).Count
$totalAnswerOnly = ($results | Where-Object { $_.AnswerOnly -gt 0 } | Measure-Object).Count
$parseErrors = ($results | Where-Object { $_.Total -eq -1 } | Measure-Object).Count

$summary = "FILES WITH ISSUES: $($results.Count)`n"
$summary += "Files with missing correct_answer: $totalMissing`n"
$summary += "Files with answer-only: $totalAnswerOnly`n"
$summary += "Files with JSON parse errors: $parseErrors`n"

$summary | Out-File -FilePath "$docsPath\audit_summary.txt" -Encoding UTF8

# Show files needing fixes
Write-Host "Audit complete."
Write-Host ""
Write-Host "=== SUMMARY ==="
Write-Host "Total files with mini_quiz issues: $($results.Count)"
Write-Host "Files needing JSON parse fix: $parseErrors"
Write-Host ""
Write-Host "Top 10 files by issue count:"
$results | Sort-Object Total -Descending | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.File): $($_.Total) issues"
}