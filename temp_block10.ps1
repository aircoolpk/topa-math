# Get block 10 (Schema A) full content
$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json" -Raw
$pattern = '(?s)"type":\s*"mini_quiz"'
$matches = [regex]::Matches($c, $pattern)
$blocks = @()
foreach ($m in $matches) {
    $braceStart = $c.IndexOf('{', $m.Index)
    if ($braceStart -eq -1) { continue }
    $depth = 0; $i = $braceStart; $blockEnd = $braceStart
    for (; $i -lt $c.Length; $i++) {
        if ($c[$i] -eq '{') { $depth++ }
        elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $blockEnd = $i; break } }
    }
    $blocks += $c.Substring($m.Index, $blockEnd - $m.Index + 1)
}

Write-Host "=== BLOCK 10 (Schema A) ==="
$blocks[10]