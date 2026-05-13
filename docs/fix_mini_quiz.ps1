function Add-MathQuizFix {
    param(
        [string]$FilePath,
        [hashtable]$QuestionPatterns
    )
    
    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $j = $content | ConvertFrom-Json
    
    $modified = $false
    
    foreach ($variant in $j.lesson_variants) {
        foreach ($block in $variant.visual_blocks) {
            if ($block.type -eq "mini_quiz" -and $block.data.questions) {
                foreach ($q in $block.data.questions) {
                    # Check if this question needs fixing
                    $text = $q.text_th
                    if ($text -and $QuestionPatterns.ContainsKey($text)) {
                        $fix = $QuestionPatterns[$text]
                        if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                            $q.correct_answer = $fix.answer
                            $q.answer = $fix.answer
                            $q.choices = $fix.choices
                            $modified = $true
                            Write-Host "  Fixed: $text -> $($fix.answer)"
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
    
    return $modified
}

$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

# g2_add_two_digit.json: addition questions
$g2_add = @{
    "67 + 21 = ?" = @{ answer = "88"; choices = @("86", "87", "88", "89") }
    "53 + 46 = ?" = @{ answer = "99"; choices = @("97", "98", "99", "100") }
}

# g2_subtract_two_digit.json: subtraction questions
$g2_subtract = @{
    "95 - 52 = ?" = @{ answer = "43"; choices = @("41", "42", "43", "44") }
    "73 - 31 = ?" = @{ answer = "42"; choices = @("40", "41", "42", "43") }
}

# g2_multiplication_intro.json: multiplication questions (x shows as A- in file)
$g2_mult = @{
    "5 x 6 = ?" = @{ answer = "30"; choices = @("28", "29", "30", "31") }
    "2 x 7 = ?" = @{ answer = "14"; choices = @("12", "13", "14", "15") }
}

# g2_times_table_2_5_10.json: times table questions
$g2_times = @{
    "4 x 2 = ?" = @{ answer = "8"; choices = @("6", "7", "8", "9") }
    "9 x 2 = ?" = @{ answer = "18"; choices = @("16", "17", "18", "19") }
    "4 x 5 = ?" = @{ answer = "20"; choices = @("18", "19", "20", "21") }
    "9 x 5 = ?" = @{ answer = "45"; choices = @("43", "44", "45", "46") }
    "4 x 10 = ?" = @{ answer = "40"; choices = @("38", "39", "40", "41") }
    "9 x 10 = ?" = @{ answer = "90"; choices = @("88", "89", "90", "91") }
}

# g2_money_change.json: money question
$g2_money = @{
    "ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?" = @{ answer = "56"; choices = @("54", "55", "56", "57") }
}

Write-Host "=== Fixing g2_add_two_digit.json ===" -ForegroundColor Cyan
Add-MathQuizFix -FilePath ($basePath + "g2_add_two_digit.json") -QuestionPatterns $g2_add

Write-Host "=== Fixing g2_subtract_two_digit.json ===" -ForegroundColor Cyan
Add-MathQuizFix -FilePath ($basePath + "g2_subtract_two_digit.json") -QuestionPatterns $g2_subtract

Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
Add-MathQuizFix -FilePath ($basePath + "g2_multiplication_intro.json") -QuestionPatterns $g2_mult

Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
Add-MathQuizFix -FilePath ($basePath + "g2_times_table_2_5_10.json") -QuestionPatterns $g2_times

Write-Host "=== Fixing g2_money_change.json ===" -ForegroundColor Cyan
Add-MathQuizFix -FilePath ($basePath + "g2_money_change.json") -QuestionPatterns $g2_money

Write-Host ""
Write-Host "Done!" -ForegroundColor Green