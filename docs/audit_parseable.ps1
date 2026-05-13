# Audit only the parseable files for mini_quiz issues
$ErrorActionPreference = "SilentlyContinue"
$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer

$results = @()

# Files that parse correctly
$okFiles = @(
    "g2_money_change.json",
    "g2_multiplication_intro.json",
    "g2_shapes_2d.json",
    "g2_times_table_2_5_10.json",
    "g2_time_calendar.json"
)

foreach ($fileName in $okFiles) {
    $filePath = $mathPath + $fileName
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    $j = $serializer.DeserializeObject($content)
    
    $fileIssues = 0
    $missingCA = 0
    $answerOnly = 0
    
    # Check lesson_variants
    if ($j.lesson_variants) {
        foreach ($variant in $j.lesson_variants) {
            if ($variant.visual_blocks) {
                foreach ($block in $variant.visual_blocks) {
                    if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                        foreach ($q in $block.data.questions) {
                            if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                                $fileIssues++
                                if ($null -ne $q.answer -and $q.answer -ne "") { 
                                    $answerOnly++ 
                                } else { 
                                    $missingCA++ 
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    $results += [PSCustomObject]@{
        File = $fileName
        MissingCorrectAnswer = $missingCA
        AnswerOnly = $answerOnly
        Total = $fileIssues
    }
}

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Files audited: $($results.Count)"
Write-Host "Total missing correct_answer: $(($results | Measure-Object -Property MissingCorrectAnswer -Sum).Sum)"
Write-Host "Total answer-only: $(($results | Measure-Object -Property AnswerOnly -Sum).Sum)"

# Save detailed issues for the fix script
$issues = @()
foreach ($fileName in $okFiles) {
    $filePath = $mathPath + $fileName
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    $j = $serializer.DeserializeObject($content)
    
    if ($j.lesson_variants) {
        $variantIdx = 0
        foreach ($variant in $j.lesson_variants) {
            $variantIdx++
            if ($variant.visual_blocks) {
                $blockIdx = 0
                foreach ($block in $variant.visual_blocks) {
                    $blockIdx++
                    if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                        $qIdx = 0
                        foreach ($q in $block.data.questions) {
                            $qIdx++
                            if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                                $issues += [PSCustomObject]@{
                                    File = $fileName
                                    Variant = $variant.variant_id
                                    BlockIndex = $blockIdx
                                    QuestionIndex = $qIdx
                                    Question = if ($q.text_th) { $q.text_th } else { "NO_TEXT" }
                                    HasAnswer = ($null -ne $q.answer -and $q.answer -ne "")
                                    Answer = if ($q.answer) { $q.answer } else { "" }
                                    HasChoices = ($null -ne $q.choices -and $q.choices -is [Array] -and $q.choices.Count -gt 0)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

$issues | Export-Csv -Path "D:\web app\4-craft.com\docs\detailed_issues.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "Issues saved to detailed_issues.csv"
$issues | Format-Table -AutoSize