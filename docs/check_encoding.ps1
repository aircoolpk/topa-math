$bytes = [System.IO.File]::ReadAllBytes("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json")
for ($i = 500; $i -lt 600; $i++) {
    Write-Host $bytes[$i] -NoNewline
    if ($i % 20 -eq 19) { Write-Host "" }
}