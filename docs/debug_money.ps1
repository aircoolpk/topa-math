# Export mini_quiz from g2_money_change for debugging
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json"
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Find mini_quiz section
$idx = $text.IndexOf("mini_quiz")
if ($idx -gt 0) {
    $endIdx = $idx + 2000
    if ($endIdx -gt $text.Length) { $endIdx = $text.Length }
    $section = $text.Substring($idx, $endIdx - $idx)
    
    # Save to file
    [System.IO.File]::WriteAllText("D:\web app\4-craft.com\docs\debug_money.txt", $section, [System.Text.Encoding]::UTF8)
    Write-Host "Saved section to debug_money.txt"
    Write-Host "Length: $($section.Length)"
} else {
    Write-Host "mini_quiz not found"
}

# Also show first 500 chars of mini_quiz
$section | Select-Object -First 500