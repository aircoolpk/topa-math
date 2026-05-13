$content = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json", [System.Text.Encoding]::UTF8)
$idx = $content.IndexOf('"mini_quiz"')
if ($idx -gt 0) {
    $section = $content.Substring($idx, 800)
    [System.IO.File]::WriteAllText("D:\web app\4-craft.com\docs\mini_quiz_sample.txt", $section, [System.Text.Encoding]::UTF8)
    Write-Host "Written to file"
}