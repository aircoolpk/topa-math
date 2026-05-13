# Check what questions actually exist in the multiplication file
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$j = $text | ConvertFrom-Json

Write-Host "=== Checking g2_multiplication_intro.json ==="
if ($j.lesson_variants) {
    $v = $j.lesson_variants[0]
    if ($v.visual_blocks) {
        $mq = $v.visual_blocks | Where-Object { $_.type -eq "mini_quiz" }
        if ($mq -and $mq.data.questions) {
            foreach ($q in $mq.data.questions) {
                Write-Host "Q: $($q.text_th)"
                Write-Host "  Length: $($q.text_th.Length)"
                Write-Host "  Bytes: "
                $qBytes = [System.Text.Encoding]::UTF8.GetBytes($q.text_th)
                Write-Host "  Hex: $(($qBytes | ForEach-Object { $_.ToString('X2') }) -join ' ')"
            }
        }
    }
}