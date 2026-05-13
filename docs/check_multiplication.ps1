# Check actual bytes in the multiplication files
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Find "5 x 6" in the text
$idx = $text.IndexOf("5 x 6")
if ($idx -gt 0) {
    $section = $text.Substring($idx, [Math]::Min(50, $text.Length - $idx))
    Write-Host "Found at index $idx"
    Write-Host "Section: $section"
    Write-Host ""
    Write-Host "Hex bytes:"
    $matchBytes = $bytes[$idx..($idx+19)]
    $hex = ($matchBytes | ForEach-Object { $_.ToString("X2") }) -join " "
    Write-Host $hex
} else {
    Write-Host "Not found"
}

# Also check with × character
$idx2 = $text.IndexOf("5 × 6")
if ($idx2 -gt 0) {
    Write-Host "Found with × at index $idx2"
}