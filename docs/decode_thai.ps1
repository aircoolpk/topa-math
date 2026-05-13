$bytes = [System.IO.File]::ReadAllBytes("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json")
# Thai UTF-8 starts with 0xE0 (224)
$thaiStart = 490
$thaiBytes = @()
for ($i = $thaiStart; $i -lt $thaiStart + 60; $i++) {
    $thaiBytes += $bytes[$i]
}
$utf8 = [System.Text.Encoding]::UTF8
$thaiText = $utf8.GetString($bytes, $thaiStart, 60)
Write-Host "Thai text (UTF-8 decoded): $thaiText"

# Also try TIS-620 (Thai Windows)
$tis620 = [System.Text.Encoding]::GetEncoding("windows-874")
$thaiTextTIS = $tis620.GetString($bytes, $thaiStart, 60)
Write-Host "Thai text (TIS-620 decoded): $thaiTextTIS"