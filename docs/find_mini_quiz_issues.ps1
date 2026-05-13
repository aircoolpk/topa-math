$ErrorActionPreference = 'SilentlyContinue'

function Get-MiniQuizIssues {
    param([string]$FilePath)
    
    $issues = @()
    try {
        $j = Get-Content $FilePath -Raw | ConvertFrom-Json
        
        # Check for lesson_variants structure
        if ($j.lesson_variants) {
            foreach ($variant in $j.lesson_variants) {
                if ($variant.visual_blocks) {
                    foreach ($block in $variant.visual_blocks) {
                        if ($block.type -eq "mini_quiz") {
                            $prob = @()
                            $q = $block
                            
                            # Check correct_answer
                            $hasCorrect = $null -ne $q.correct_answer
                            if (-not $hasCorrect) { $prob += "MISSING_correct_answer" }
                            
                            # Check choices
                            if ($q.choices -eq $null) {
                                $prob += "NULL_choices"
                            } elseif (-not ($q.choices -is [Array])) {
                                $prob += "NON_ARRAY_choices"
                            } elseif ($q.choices.Count -eq 0) {
                                $prob += "EMPTY_choices"
                            } else {
                                # Check if choices are just A,B,C,D
                                $allABCD = $true
                                foreach ($c in $q.choices) {
                                    if ($c -notin @("A","B","C","D")) { $allABCD = $false; break }
                                }
                                if ($allABCD -and $q.choices.Count -eq 4) {
                                    $prob += "CHOICES_are_ABCD"
                                }
                            }
                            
                            if ($prob.Count -gt 0) {
                                $issues += [PSCustomObject]@{
                                    File = $FilePath
                                    Location = "lesson_variants.visual_blocks.mini_quiz"
                                    Question = if ($q.question) { $q.question.Substring(0, [Math]::Min(60, $q.question.Length)) } else { "N/A" }
                                    Problems = ($prob -join "; ")
                                    Answer = $q.answer
                                    CorrectAnswer = $q.correct_answer
                                    Choices = if ($q.choices -is [Array]) { ($q.choices -join ", ") } else { "$($q.choices)" }
                                    ChoicesType = if ($q.choices -is [Array]) { "Array" } else { $(if($q.choices){$q.choices.GetType().Name}else{'null'}) }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        # Also check top-level mini_quiz if it exists
        if ($j.mini_quiz) {
            foreach ($q in $j.mini_quiz) {
                $prob = @()
                $hasCorrect = $null -ne $q.correct_answer
                if (-not $hasCorrect) { $prob += "MISSING_correct_answer" }
                
                if ($q.choices -eq $null) {
                    $prob += "NULL_choices"
                } elseif (-not ($q.choices -is [Array])) {
                    $prob += "NON_ARRAY_choices"
                } elseif ($q.choices.Count -eq 0) {
                    $prob += "EMPTY_choices"
                }
                
                if ($prob.Count -gt 0) {
                    $issues += [PSCustomObject]@{
                        File = $FilePath
                        Location = "top-level mini_quiz"
                        Question = if ($q.question) { $q.question.Substring(0, [Math]::Min(60, $q.question.Length)) } else { "N/A" }
                        Problems = ($prob -join "; ")
                        Answer = $q.answer
                        CorrectAnswer = $q.correct_answer
                        Choices = if ($q.choices -is [Array]) { ($q.choices -join ", ") } else { "$($q.choices)" }
                        ChoicesType = if ($q.choices -is [Array]) { "Array" } else { $(if($q.choices){$q.choices.GetType().Name}else{'null'}) }
                    }
                }
            }
        }
    }
    catch {
        $issues += [PSCustomObject]@{
            File = $FilePath
            Location = "PARSE_ERROR"
            Question = "N/A"
            Problems = "PARSE_ERROR: $($_.Exception.Message)"
            Answer = $null
            CorrectAnswer = $null
            Choices = $null
            ChoicesType = $null
        }
    }
    
    return $issues
}

$files = Get-ChildItem "D:\web app\4-craft.com\apps\api\app\content\math" -Filter "*.json" -Recurse
$allIssues = @()

foreach ($f in $files) {
    $allIssues += Get-MiniQuizIssues -FilePath $f.FullName
}

Write-Host "=== ALL MINI_QUIZ ISSUES ===" -ForegroundColor Yellow
$allIssues | Format-List * -Force

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Total issues found: $($allIssues.Count)"
$allIssues | Group-Object Problems | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}

$allIssues | Export-Csv -Path "D:\web app\4-craft.com\docs\mini_quiz_issues_detailed.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "Exported to: D:\web app\4-craft.com\docs\mini_quiz_issues_detailed.csv"