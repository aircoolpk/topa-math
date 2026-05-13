$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json" -Raw
$blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,5000}')
"$($blocks.Count) mini_quiz blocks"
foreach ($b in $blocks[0..1]) {
    $v = $b.Value
    Write-Host "=== Block len=$($v.Length) ==="
    Write-Host $v.Substring(0, [Math]::Min(1500, $v.Length))
}