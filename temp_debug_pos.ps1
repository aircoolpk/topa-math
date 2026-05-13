# Debug: find actual positions of mini_quiz in g2_add_two_digit.json
$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json" -Raw
$pattern = '(?s)"type":\s*"mini_quiz"'
$matches = [regex]::Matches($c, $pattern)
Write-Host "Found $($matches.Count) matches"
foreach ($m in $matches[0..2]) {
    Write-Host "Match at index $($m.Index): $($c.Substring($m.Index, 100))"
}