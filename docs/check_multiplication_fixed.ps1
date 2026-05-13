# Check if the files are valid JSON after the fix
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Test JSON parse
try {
    $j = $text | ConvertFrom-Json -ErrorAction Stop
    Write-Host "JSON valid"
    Write-Host "lesson_variants count: $($j.lesson_variants.Count)"
    
    # Find mini_quiz in variant 1
    foreach ($vb in $j.lesson_variants[0].visual_blocks) {
        if ($vb.type -eq "mini_quiz") {
            Write-Host "Found mini_quiz block"
            Write-Host "Questions count: $($vb.data.questions.Count)"
            foreach ($q in $vb.data.questions) {
                Write-Host "Q: $($q.text_th)"
                Write-Host "  choices: $($q.choices | ConvertTo-Json -Compress)"
                Write-Host "  answer: $($q.answer)"
                Write-Host "  correct_answer: $($q.correct_answer)"
                Write-Host ""
            }
        }
    }
} catch {
    Write-Host "JSON parse error: $_"
    Write-Host "First 500 chars of file:"
    Write-Host $text.Substring(0, 500)
}