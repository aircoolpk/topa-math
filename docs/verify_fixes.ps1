# Verify the fixes worked
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$j = $text | ConvertFrom-Json

$q = $j.lesson_variants[0].visual_blocks[5].data.questions[1]
Write-Host "=== g2_multiplication_intro.json v01 Q2 ==="
Write-Host "choices: $($q.choices | ConvertTo-Json)"
Write-Host "answer: $($q.answer)"
Write-Host "correct_answer: $($q.correct_answer)"

$file2 = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_times_table_2_5_10.json"
$bytes2 = [System.IO.File]::ReadAllBytes($file2)
$text2 = [System.Text.Encoding]::UTF8.GetString($bytes2)
$j2 = $text2 | ConvertFrom-Json

$q2 = $j2.lesson_variants[0].visual_blocks[5].data.questions[1]
Write-Host ""
Write-Host "=== g2_times_table_2_5_10.json v01 Q2 ==="
Write-Host "choices: $($q2.choices | ConvertTo-Json)"
Write-Host "answer: $($q2.answer)"
Write-Host "correct_answer: $($q2.correct_answer)"