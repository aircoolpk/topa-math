# Fix Schema B blocks - add simple explanation_th
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()

function Get-FullMiniQuizBlocks($content) {
    $blocks = @()
    $pattern = '(?s)"type":\s*"mini_quiz"'
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $braceStart = $content.IndexOf('{', $m.Index)
        if ($braceStart -eq -1) { continue }
        $depth = 0; $i = $braceStart; $endPos = $braceStart
        for (; $i -lt $content.Length; $i++) {
            if ($content[$i] -eq '{') { $depth++ }
            elseif ($content[$i] -eq '}') { 
                $depth--
                if ($depth -eq 0) { $endPos = $i; break }
            }
        }
        $block = $content.Substring($m.Index, $endPos - $m.Index + 1)
        $blocks += [PSCustomObject]@{StartIndex=$m.Index; EndIndex=$endPos; Block=$block}
    }
    return $blocks
}

$files = @(
    "$base\grade_2\lessons\g2_add_two_digit.json",
    "$base\grade_2\lessons\g2_money_change.json",
    "$base\grade_2\lessons\g2_multiplication_intro.json",
    "$base\grade_2\lessons\g2_shapes_2d.json",
    "$base\grade_2\lessons\g2_subtract_two_digit.json",
    "$base\grade_2\lessons\g2_times_table_2_5_10.json",
    "$base\grade_2\lessons\g2_time_calendar.json"
)

foreach ($f in $files) {
    $c = Get-Content $f -Raw
    $blocks = Get-FullMiniQuizBlocks $c
    $fixedCount = 0
    
    foreach ($blk in $blocks) {
        $block = $blk.Block
        $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaB -and -not $hasExplTH) {
            if ($block -match ',?\s*\}\s*$') {
                $withoutTrailing = $block -replace ',?\s*\}\s*$', ''
                $newBlock = $withoutTrailing + ",`n                                                          ""explanation_th"": ""ดูเฉลยในคำตอบที่ถูกต้อง""`n                                                      }"
                $c = $c.Substring(0, $blk.StartIndex) + $newBlock + $c.Substring($blk.EndIndex + 1)
                $fixedCount++
            }
        }
    }
    
    if ($fixedCount -gt 0) {
        $c | Set-Content $f -NoNewline -Encoding UTF8
        $fn = $f.Split('\')[-1]
        $fixedFiles += "$fn : $fixedCount blocks"
        Write-Host "Fixed: $fn - $fixedCount blocks"
    }
}

Write-Host ""
Write-Host "Total fixed: $($fixedFiles.Count) files"