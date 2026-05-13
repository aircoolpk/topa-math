$content = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json", [System.Text.Encoding]::UTF8)
# Find the mini_quiz section
$idx = $content.IndexOf('"mini_quiz"')
if ($idx -gt 0) {
    $section = $content.Substring($idx, 500)
    Write-Host $section
}