$content = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json", [System.Text.Encoding]::UTF8)
$j = $content | ConvertFrom-Json
$qs = $j.lesson_variants[0].visual_blocks[3].data.questions
for ($i = 0; $i -lt $qs.Count; $i++) {
    $q = $qs[$i]
    Write-Host "Q[$i]: $($q.text_th)"
    Write-Host "   Answer: $($q.answer)"
    Write-Host "   CorrectAnswer: $($q.correct_answer)"
    $choicesStr = if ($q.choices) { $q.choices -join ', ' } else { "MISSING" }
    Write-Host "   Choices: $choicesStr"
    Write-Host ""
}