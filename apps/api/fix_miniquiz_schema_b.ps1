# Schema B Fix Script for grade_2 lessons
$ErrorActionPreference = "Stop"
$sourceDir = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons"
$expFile = "D:\web app\4-craft.com\apps\api\thai_explanations.txt"
$files = @(
    "g2_add_two_digit.json",
    "g2_money_change.json",
    "g2_multiplication_intro.json",
    "g2_shapes_2d.json",
    "g2_subtract_two_digit.json",
    "g2_times_table_2_5_10.json",
    "g2_time_calendar.json"
)

# Write Thai explanations file (UTF-8 with BOM)
$lines = @(
    "g2_add_two_digit|?าร?วกเ?ขสองหลักแบบไม่ทด ให้?วกหลักหน่วยก่อนแล้ว?วกหลักสิบ ผล?วกไม่เกิน 9",
    "g2_subtract_two_digit|?าร?บ?�ขสองหลักแบบไม่ยืม ให้?บหลักหน่วยก่อนแล้ว?บหลักสิบ ตัวตั้งมากกว่า?วม",
    "g2_money_change|?ารคิดเงินทอน ให้?บราคาสินค้าจากเงินที่จ่าย ถ้าเงินไม่พอทอนใช้?รียญรวมกัน",
    "g2_multiplication_intro|?ารคูณคือ?าร?วกซ้ำๆ ?ำนวนกลุ่ม × ?ำนวนต่อกลุ่ม = ผลรวม",
    "g2_times_table_2_5_10|สูตรคูณ 2, 5, 10 มี pattern ชัดเจน คูณ 2 ทวีคูณ คูณ 5 ลงท้าย 0 หรือ 5 คูณ 10 เติม 0",
    "g2_shapes_2d|รูปร่างสองมิติมีคุณสมบัติเฉพาะ เช่น จำนวนด้าน จำนวนมุม ความยาวด้าน",
    "g2_time_calendar|?ารอ่านเวลาดูชั่วโมงนาทีจากเข็มนาฬิกา ปฏิทินดูวัน สัปดาห์ เดือน ปี"
)
$encoding = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllLines($expFile, $lines, $encoding)

# Load explanations
$expHash = @{}
Get-Content $expFile -Encoding UTF8 | ForEach-Object {
    $parts = $_ -split [char]124
    if ($parts.Count -eq 2) { $expHash[$parts[0]] = $parts[1] }
}

foreach ($file in $files) {
    $path = Join-Path $sourceDir $file
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    Write-Host "Processing $file..."
    $original = $content
    
    $expKey = $file -replace '.json$', ''
    $exp = if ($expHash.ContainsKey($expKey)) { $expHash[$expKey] } else { "ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง" }
    
    # Fix 1: Replace placeholder with Thai explanation
    $content = $content -replace 'explanation_th"\s*:\s*"See correct answer above"', "explanation_th`":`"$exp`""
    
    # Fix 2: Rename "answer" to "correct_answer"
    $content = $content -replace '("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"\s*:\s*"([^"]+)"', '$1"correct_answer": "$2"'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  Fixed: $file"
    } else {
        Write-Host "  No changes: $file"
    }
}

Write-Host "Done."