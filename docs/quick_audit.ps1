# Quick Mini Quiz Audit
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
$unresolved = @()
$resolved = @()

foreach ($file in $jsonFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $j = Parse-Json -JsonText $content
        
        # Check top-level mini_quiz
        if ($j.mini_quiz -and $j.mini_quiz.questions) {
            foreach ($q in $j.mini_quiz.questions) {
                $issue = @{
                    File = $file.Name
                    Path = $file.FullName.Replace($docsPath, "").TrimStart("\")
                    Location = "top-level mini_quiz"
                    Text = if ($q.text_th) { $q.text_th.Substring(0, [Math]::Min(30, $q.text_th.Length)) } else { "NO_TEXT" }
                    HasCorrectAnswer = -not ($null -eq $q.correct_answer -or $q.correct_answer -eq "")
                    HasAnswer = -not ($null -eq $q.answer -or $q.answer -eq "")
                    HasChoices = ($null -ne $q.choices -and $q.choices -is [Array] -and $q.choices.Count -gt 0)
                }
                
                if (-not $issue.HasCorrectAnswer) {
                    if ($issue.HasAnswer) {
                        $issue.Type = "using answer instead of correct_answer"
                    } else {
                        $issue.Type = "missing correct_answer"
                    }
                    $issues += $issue
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
                                $issue = @{
                                    File = $file.Name
                                    Path = $file.FullName.Replace($docsPath, "").TrimStart("\")
                                    Location = "variant[$($variantId)].mini_quiz"
                                    Text = if ($q.text_th) { $q.text_th.Substring(0, [Math]::Min(30, $q.text_th.Length)) } else { "NO_TEXT" }
                                    HasCorrectAnswer = -not ($null -eq $q.correct_answer -or $q.correct_answer -eq "")
                                    HasAnswer = -not ($null -eq $q.answer -or $q.answer -eq "")
                                    HasChoices = ($null -ne $q.choices -and $q.choices -is [Array] -and $q.choices.Count -gt 0)
                                }
                                
                                if (-not $issue.HasCorrectAnswer) {
                                    if ($issue.HasAnswer) {
                                        $issue.Type = "using answer instead of correct_answer"
                                    } else {
                                        $issue.Type = "missing correct_answer"
                                    }
                                    $issues += $issue
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "Error parsing $($file.FullName): $_"
    }
}

# Summary
$missingCA = ($issues | Where-Object { $_.Type -eq "missing correct_answer" }).Count
$usingAnswer = ($issues | Where-Object { $_.Type -eq "using answer instead of correct_answer" }).Count

Write-Host ""
Write-Host "=== AUDIT SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total issues: $($issues.Count)"
Write-Host "Missing correct_answer: $missingCA"
Write-Host "Using answer instead of correct_answer: $usingAnswer"
Write-Host ""
Write-Host "Files with issues:"
$issues | Select-Object -ExpandProperty File -Unique | ForEach-Object { Write-Host "  $_" }

# Save issues to CSV
$issues | Export-Csv -Path "$docsPath\mini_quiz_issues.csv" -NoTypeInformation -Encoding UTF8

# Show detailed issues
Write-Host ""
Write-Host "=== DETAILED ISSUES ===" -ForegroundColor Yellow
$issues | ForEach-Object {
    Write-Host "$($_.File) | $($_.Location) | $($_.Text)... | $($_.Type)"
}

Write-Host ""
Write-Host "Issues saved to: $docsPath\mini_quiz_issues.csv"