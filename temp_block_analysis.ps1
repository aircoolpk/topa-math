# Full content dump of g2_add_two_digit block analysis
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$c = Get-Content "$base\grade_2\lessons\g2_add_two_digit.json" -Raw
$pattern = '(?s)"type":\s*"mini_quiz"'
$matches = [regex]::Matches($c, $pattern)
$blocks = @()
foreach ($m in $matches) {
    $braceStart = $c.IndexOf('{', $m.Index); if ($braceStart -eq -1) { continue }
    $depth = 0; $i = $braceStart; $blockEnd = $braceStart
    for (; $i -lt $c.Length; $i++) { if ($c[$i] -eq '{') { $depth++ } elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $blockEnd = $i; break } } }
    $blocks += $c.Substring($m.Index, $blockEnd - $m.Index + 1)
}

# Check each block for explanation_th
foreach ($b in $blocks) {
    $hasExplTH = $b -match 'explanation_th'
    $hasAnswer = $b -match '"answer":\s*"[^"]+"'
    $hasCorrectAnswer = $b -match 'correct_answer'
    $isSchemaB = $b -match '"data":\s*\{'
    "$($blocks.IndexOf($b)): schemaB=$isSchemaB hasAnswer=$hasAnswer hasCorrectAnswer=$hasCorrectAnswer hasExplTH=$hasExplTH"
}

# Check block 0 full content
Write-Host "`n=== BLOCK 0 FULL ==="
$blocks[0]