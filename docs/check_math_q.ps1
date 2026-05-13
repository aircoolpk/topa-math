$j = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json" -Raw | ConvertFrom-Json
$qs = $j.lesson_variants[0].visual_blocks[5].data.questions
for ($i = 0; $i -lt $qs.Count; $i++) {
    $q = $qs[$i]
    Write-Host "Q[$i]: $($q.text_th)"
    Write-Host "   Answer: $($q.answer)"
    Write-Host "   CorrectAnswer: $($q.correct_answer)"
    Write-Host "   Choices: $($q.choices -join ', ')"
    Write-Host ""
}