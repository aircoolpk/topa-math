# Get Schema B block content to see what explanation fields exist
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$c = Get-Content "$base\grade_2\lessons\g2_add_two_digit.json" -Raw
$blocks = @()
$pattern = '(?s)"type":\s*"mini_quiz"'
$matches = [regex]::Matches($c, $pattern)
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

# Print 2nd block (first Schema B)
Write-Host "=== BLOCK 2 (Schema B) ==="
$blocks[1]
Write-Host ""
Write-Host "=== BLOCK 1 (Schema A) ==="  
$blocks[0]