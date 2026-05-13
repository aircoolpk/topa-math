$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

function Fix-File {
    param([string]$FilePath, [string]$QuestionText, [string]$Answer, [string[]]$Choices)
    
    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $j = $content | ConvertFrom-Json
    
    $modified = $false
    
    foreach ($variant in $j.lesson_variants) {
        foreach ($block in $variant.visual_blocks) {
            if ($block.type -eq "mini_quiz" -and $block.data.questions) {
                foreach ($q in $block.data.questions) {
                    if ($q.text_th -eq $QuestionText) {
                        if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                            $q.correct_answer = $Answer
                            $q.answer = $Answer
                            $q.choices = $Choices
                            $modified = $true
                            Write-Host "  Fixed: $QuestionText -> $Answer"
                        }
                    }
                }
            }
        }
    }
    
    if ($modified) {
        $output = $j | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($FilePath, $output, [System.Text.Encoding]::UTF8)
        Write-Host "  Saved: $FilePath"
    }
}

# g2_add_two_digit.json
Write-Host "=== Fixing g2_add_two_digit.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_add_two_digit.json"
Fix-File -FilePath $fp -QuestionText "67 + 21 = ?" -Answer "88" -Choices @("86", "87", "88", "89")
Fix-File -FilePath $fp -QuestionText "53 + 46 = ?" -Answer "99" -Choices @("97", "98", "99", "100")

# g2_subtract_two_digit.json
Write-Host "=== Fixing g2_subtract_two_digit.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_subtract_two_digit.json"
Fix-File -FilePath $fp -QuestionText "95 - 52 = ?" -Answer "43" -Choices @("41", "42", "43", "44")
Fix-File -FilePath $fp -QuestionText "73 - 31 = ?" -Answer "42" -Choices @("40", "41", "42", "43")

# g2_multiplication_intro.json
Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
Fix-File -FilePath $fp -QuestionText "5 x 6 = ?" -Answer "30" -Choices @("28", "29", "30", "31")
Fix-File -FilePath $fp -QuestionText "2 x 7 = ?" -Answer "14" -Choices @("12", "13", "14", "15")

# g2_times_table_2_5_10.json
Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
Fix-File -FilePath $fp -QuestionText "4 x 2 = ?" -Answer "8" -Choices @("6", "7", "8", "9")
Fix-File -FilePath $fp -QuestionText "9 x 2 = ?" -Answer "18" -Choices @("16", "17", "18", "19")
Fix-File -FilePath $fp -QuestionText "4 x 5 = ?" -Answer "20" -Choices @("18", "19", "20", "21")
Fix-File -FilePath $fp -QuestionText "9 x 5 = ?" -Answer "45" -Choices @("43", "44", "45", "46")
Fix-File -FilePath $fp -QuestionText "4 x 10 = ?" -Answer "40" -Choices @("38", "39", "40", "41")
Fix-File -FilePath $fp -QuestionText "9 x 10 = ?" -Answer "90" -Choices @("88", "89", "90", "91")

Write-Host ""
Write-Host "Done!" -ForegroundColor Green