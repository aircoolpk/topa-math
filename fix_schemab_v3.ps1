# Fix Schema B blocks: add explanation_th where missing
# Process matches from HIGH index to LOW index to avoid index shifting issues

$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()
$explText = "See correct answer above"

$g2Files = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedCount = 0
    
    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    $matchCount = $matches.Count
    
    # Process from HIGH index to LOW index (backwards)
    for ($idx = $matchCount - 1; $idx -ge 0; $idx--) {
        $m = $matches[$idx]
        $startIdx = $m.Index
        $braceStart = $c.IndexOf('{', $startIdx)
        if ($braceStart -eq -1) { continue }
        
        $depth = 0; $endIdx = $braceStart
        for ($i = $braceStart; $i -lt $c.Length; $i++) {
            if ($c[$i] -eq '{') { $depth++ }
            elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
        }
        
        $block = $c.Substring($startIdx, $endIdx - $startIdx + 1)
        
        $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaB -and -not $hasExplTH) {
            $lastBrace = $block.LastIndexOf('}')
            if ($lastBrace -gt 0) {
                $insertStr = @"

                                                          "explanation_th": "$explText"
"@
                $newBlock = $block.Substring(0, $lastBrace) + $insertStr + "                                                      }"
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($endIdx + 1)
                $fixedCount++
            }
        }
    }
    
    if ($fixedCount -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedCount blocks"
        Write-Host "Fixed: $($f.Name) - $fixedCount blocks"
    }
}

Write-Host ""
Write-Host "Total fixed: $($fixedFiles.Count) files"