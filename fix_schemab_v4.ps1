# Fix Schema B blocks: add explanation_th where missing
# Process from LOW index to HIGH index, adjusting indices after each modification

$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()
$explText = "See correct answer above"

$g2Files = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $fixedCount = 0
    
    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    
    # Process from LOW index to HIGH (forwards), adjusting index after each modification
    $indexOffset = 0
    
    for ($idx = 0; $idx -lt $matches.Count; $idx++) {
        $m = $matches[$idx]
        $origIndex = $m.Index
        $startIdx = $origIndex + $indexOffset
        
        $braceStart = $c.IndexOf('{', $startIdx)
        if ($braceStart -eq -1) { continue }
        
        $depth = 0; $endIdx = $braceStart
        for ($i = $braceStart; $i -lt $c.Length; $i++) {
            if ($c[$i] -eq '{') { $depth++ }
            elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
        }
        
        $blockLen = $endIdx - $startIdx + 1
        $block = $c.Substring($startIdx, $blockLen)
        
        $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaB -and -not $hasExplTH) {
            $lastBrace = $block.LastIndexOf('}')
            if ($lastBrace -gt 0) {
                $insertStr = @"

                                                          "explanation_th": "$explText"
"@
                $newBlock = $block.Substring(0, $lastBrace) + $insertStr + "                                                      }"
                $oldLen = $blockLen
                $newLen = $newBlock.Length
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $oldLen)
                $indexOffset += ($newLen - $oldLen)
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