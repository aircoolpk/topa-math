$bytes = [System.IO.File]::ReadAllBytes("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json")

# Try different encodings
$encodings = @("utf-8", "windows-874", "iso-8859-11", "windows-1252")

foreach ($encName in $encodings) {
    try {
        $enc = [System.Text.Encoding]::GetEncoding($encName)
        $start = 490
        $len = 80
        $text = $enc.GetString($bytes, $start, $len)
        Write-Host "$encName`: $text"
    } catch {
        Write-Host "$encName`: ERROR - $_"
    }
}

# Also look at raw bytes in hex
Write-Host ""
Write-Host "Raw bytes (hex):"
for ($i = 490; $i -lt 570; $i++) {
    Write-Host ("{0:X2} " -f $bytes[$i]) -NoNewline
    if (($i - 489) % 16 -eq 0) { Write-Host "" }
}