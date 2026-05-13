$content = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json", [System.Text.Encoding]::UTF8)
$idx = $content.IndexOf('"mini_quiz"')
$section = $content.Substring($idx, 2000)
[System.IO.File]::WriteAllText("D:\web app\4-craft.com\docs\g2_money_change_miniquiz.txt", $section, [System.Text.Encoding]::UTF8)
Write-Host "Done"

$content2 = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_shapes_2d.json", [System.Text.Encoding]::UTF8)
$idx2 = $content2.IndexOf('"mini_quiz"')
$section2 = $content2.Substring($idx2, 2000)
[System.IO.File]::WriteAllText("D:\web app\4-craft.com\docs\g2_shapes_2d_miniquiz.txt", $section2, [System.Text.Encoding]::UTF8)
Write-Host "Done"

$content3 = [System.IO.File]::ReadAllText("D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_time_calendar.json", [System.Text.Encoding]::UTF8)
$idx3 = $content3.IndexOf('"mini_quiz"')
$section3 = $content3.Substring($idx3, 2000)
[System.IO.File]::WriteAllText("D:\web app\4-craft.com\docs\g2_time_calendar_miniquiz.txt", $section3, [System.Text.Encoding]::UTF8)
Write-Host "Done"