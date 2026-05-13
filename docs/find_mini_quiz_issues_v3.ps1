$ErrorActionPreference = 'SilentlyContinue'

function Get-MiniQuizIssues {
    param([string]$FilePath)
    
    $issues = @()
    try {
        $j = Get-Content $FilePath -Raw | ConvertFrom-Json
        
        if (-not ($j.lesson_variants)) {
            return $issues
        }
        
        $variantIndex = 0
        foreach ($variant in $j.lesson_variants) {
            if ($variant.visual_blocks) {
                $blockIndex = 0
                foreach ($block in $variant.visual_blocks) {
                    if ($block.type -eq "mini_quiz" -and $block.data.questions) {
                        $qIndex = 0
                        foreach ($q in $block.data.questions) {
                            $prob = @()
                            
                            # Check correct_answer
                            $hasCorrect = $null -ne $q.correct_answer -and $q.correct_answer -ne ""
                            if (-not $hasCorrect) { $prob += "MISSING_correct_answer" }
                            
                            # Check choices
                            if ($q.choices -eq $null) {
                                $prob += "NULL_choices"
                            } elseif (-not ($q.choices -is [Array])) {
                                $prob += "NON_ARRAY_choices"
                            } elseif ($q.choices.Count -eq 0) {
                                $prob += "EMPTY_choices"
                            }
                            
                            if ($prob.Count -gt 0) {
                                $issues += [PSCustomObject]@{
                                    File = Split-Path $FilePath -Leaf
                                    FilePath = $FilePath
                                    Location = "lesson_variants[$variantIndex].visual_blocks[$blockIndex].data.questions[$qIndex]"
                                    Question = if ($q.text_th) { $q.text_th.Substring(0, [Math]::Min(60, $q.text_th.Length)) } else { "N/A" }
                                    Problems = ($prob -join "; ")
                                    Answer = $q.answer
                                    CorrectAnswer = $q.correct_answer
                                    Choices = if ($q.choices -is [Array]) { ($q.choices -join ", ") } else { "$($q.choices)" }
                                }
                            }
                            $qIndex++
                        }
                    }
                    $blockIndex++
                }
            }
            $variantIndex++
        }
    }
    catch {
        Write-Host "Error processing $FilePath : $_"
    }
    
    return $issues
}

$files = Get-ChildItem "D:\web app\4-craft.com\apps\api\app\content\math" -Filter "*.json" -Recurse | Where-Object { $_.Name -notlike "*LESSON_CONTENT*" -and $_.Name -notlike "*QUESTION*" -and $_.Name -notlike "*moltbook*" }
$allIssues = @()

foreach ($f in $files) {
    $allIssues += Get-MiniQuizIssues -FilePath $f.FullName
}

Write-Host "=== MINI_QUIZ QUESTIONS WITH ISSUES ===" -ForegroundColor Yellow
$allIssues | Format-List * -Force

Write-Host ""
Write-Host "=== SUMMARY BY PROBLEM TYPE ===" -ForegroundColor Yellow
$allIssues | Group-Object Problems | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) occurrences"
}

Write-Host ""
Write-Host "=== SUMMARY BY FILE ===" -ForegroundColor Yellow
$allIssues | Group-Object File | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) issues"
}

Write-Host ""
Write-Host "Total issues: $($allIssues.Count)" -ForegroundColor Cyan

$uniqueFiles = ($allIssues | Select-Object -ExpandProperty FilePath -Unique).Count
Write-Host "Unique files with issues: $uniqueFiles" -ForegroundColor Cyan

$allIssues | Export-Csv -Path "D:\web app\4-craft.com\docs\mini_quiz_issues_v3.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "Exported to: D:\web app\4-craft.com\docs\mini_quiz_issues_v3.csv"