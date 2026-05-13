# Extract block content using brace counting - then show each unique block
$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json" -Raw
$pattern = '(?s)"type":\s*"mini_quiz"'
$matches = [regex]::Matches($c, $pattern)
$blocks = @()
foreach ($m in $matches) {
    $braceStart = $c.IndexOf('{', $m.Index)
    if ($braceStart -eq -1) { continue }
    $depth = 0
    $i = $braceStart; $blockEnd = $braceStart
    for (; $i -lt $c.Length; $i++) {
        if ($c[$i] -eq '{') { $depth++ }
        elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $blockEnd = $i; break } }
    }
    $blocks += $c.Substring($m.Index, $blockEnd - $m.Index + 1)
}

# Show all 11 blocks - first 500 chars of each
for ($i = 0; $i -lt $blocks.Count; $i++) {
    Write-Host "=== BLOCK $i (len=$($blocks[$i].Length)) ==="
    Write-Host $blocks[$i].Substring(0, [Math]::Min(500, $blocks[$i].Length))
    Write-Host ""
}