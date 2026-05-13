# Debug string matching
$timesChar = [char]0x00D7  # ×

$key1 = "5$($timesChar)6 = ?"
Write-Host "Key1 constructed: $key1"
Write-Host "Key1 bytes: "
$key1Bytes = [System.Text.Encoding]::UTF8.GetBytes($key1)
Write-Host "Hex: $(($key1Bytes | ForEach-Object { $_.ToString('X2') }) -join ' ')"

# Now get actual question text from file
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$j = $text | ConvertFrom-Json

$qText = $j.lesson_variants[0].visual_blocks[5].data.questions[1].text_th
Write-Host ""
Write-Host "Actual Q2: $qText"
Write-Host "Q2 bytes: "
$qBytes = [System.Text.Encoding]::UTF8.GetBytes($qText)
Write-Host "Hex: $(($qBytes | ForEach-Object { $_.ToString('X2') }) -join ' ')"

Write-Host ""
Write-Host "StartsWith check: $($qText.StartsWith($key1))"
Write-Host "Direct equality: $($qText -eq $key1)"