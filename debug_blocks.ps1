$f = Get-ChildItem "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json"
$c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
$matches = [regex]::Matches($c, '"type":  "mini_quiz"')
Write-Host "Initial matches: $($matches.Count)"
$indexOffset = 0

for ($idx = 0; $idx -lt $matches.Count; $idx++) {
    $m = $matches[$idx]
    $origIndex = $m.Index
    $startIdx = $origIndex + $indexOffset
    
    $braceStart = $c.IndexOf('{', $startIdx)
    if ($braceStart -eq -1) { Write-Host "idx=$idx : no brace"; continue }
    
    $depth = 0; $endIdx = $braceStart
    for ($i = $braceStart; $i -lt $c.Length; $i++) {
        if ($c[$i] -eq '{') { $depth++ }
        elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
    }
    
    $blockLen = $endIdx - $startIdx + 1
    $block = $c.Substring($startIdx, $blockLen)
    
    $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
    $hasExplTH = $block -match 'explanation_th'
    
    Write-Host "idx=$idx origIdx=$origIndex offset=$indexOffset startIdx=$startIdx : schemaB=$isSchemaB hasExplTH=$hasExplTH blockLen=$blockLen"
    
    if ($isSchemaB -and -not $hasExplTH) {
        Write-Host "  -> Would fix this block"
    }
}