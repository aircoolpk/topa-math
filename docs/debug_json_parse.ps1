# Debug JSON parsing
$fp = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json"
$jsonText = [System.IO.File]::ReadAllText($fp, [System.Text.Encoding]::UTF8)
$j = $jsonText | ConvertFrom-Json

Write-Host "Parsed successfully"
Write-Host "lesson_variants count: $($j.lesson_variants.Count)"

if ($j.lesson_variants) {
    $v = $j.lesson_variants[0]
    if ($v.visual_blocks) {
        $miniQuiz = $v.visual_blocks | Where-Object { $_.type -eq "mini_quiz" }
        if ($miniQuiz) {
            Write-Host "Found mini_quiz"
            Write-Host "Questions count: $($miniQuiz.data.questions.Count)"
            foreach ($q in $miniQuiz.data.questions) {
                Write-Host "Q: $($q.text_th)"
                Write-Host "  Has correct_answer: $(-not ($null -eq $q.correct_answer))"
                Write-Host "  correct_answer value: $($q.correct_answer)"
                Write-Host "  Has choices: $(-not ($null -eq $q.choices))"
            }
        }
    }
}