# Fix mini_quiz schema issues using direct string replacement
# DO NOT use ConvertFrom-Json for modifications - creates read-only objects

$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()

# ============================================================
# GRADE 2: Schema B blocks have data.questions[] with answer field
# We need to: add correct_answer (copy answer value), add explanation_th
# ============================================================

Write-Host "=== Fixing Grade 2 Schema B blocks ==="
$g2Files = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedCount = 0

    # Find all mini_quiz blocks using double-space pattern
    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    
    # Convert to array and process high to low index
    $matchArray = @()
    foreach ($m in $matches) { $matchArray += $m }
    
    $indexOffset = 0
    
    for ($idx = 0; $idx -lt $matchArray.Count; $idx++) {
        $m = $matchArray[$idx]
        $origIndex = $m.Index
        $startIdx = $origIndex + $indexOffset
        
        # Find opening brace
        $braceStart = $c.IndexOf('{', $startIdx)
        if ($braceStart -eq -1) { continue }
        
        # Extract block using brace counting
        $depth = 0; $endIdx = $braceStart
        for ($i = $braceStart; $i -lt $c.Length; $i++) {
            if ($c[$i] -eq '{') { $depth++ }
            elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $endIdx = $i; break } }
        }
        
        $blockLen = $endIdx - $startIdx + 1
        $block = $c.Substring($startIdx, $blockLen)
        
        # Check if Schema B (has data.questions)
        $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaB) {
            # For Schema B, we need to:
            # 1. Add correct_answer to each question if missing (copy answer value)
            # 2. Add explanation_th at block level if missing
            
            # First, add correct_answer to questions that have answer but not correct_answer
            # Pattern: "answer": "VALUE" followed by possible fields but not correct_answer
            $newBlock = $block
            
            # Find all occurrences of "answer": "X" where next line doesn't have correct_answer
            $answerPattern = '"answer":\s*"([^"]+)""'
            $answerMatches = [regex]::Matches($newBlock, $answerPattern)
            
            # Process from end to beginning to avoid index shifting
            $answerOffset = 0
            foreach ($am in $answerMatches) {
                $answerValue = $am.Groups[1].Value
                $posInBlock = $am.Index + $answerOffset
                
                # Check if this answer is followed by correct_answer
                $afterAnswer = $newBlock.Substring($am.Index + $am.Length)
                if ($afterAnswer -notmatch '^\s*"correct_answer"') {
                    # Need to insert correct_answer after this answer
                    $insertStr = "`n                                              ""correct_answer"": ""$answerValue"""
                    $oldLen = $newBlock.Length
                    $newBlock = $newBlock.Substring(0, $am.Index + $am.Length - 1) + $insertStr + $newBlock.Substring($am.Index + $am.Length)
                    $answerOffset += $insertStr.Length
                }
            }
            
            # Second, add explanation_th if missing
            if (-not ($newBlock -match 'explanation_th')) {
                # Find the last closing brace and insert before it
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

                                                          "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "                                                      }"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $blockLenDiff = $newBlock.Length - $blockLen
                $indexOffset += $blockLenDiff
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
Write-Host "Grade 2 Schema B fixed: $($fixedFiles.Count) files"
Write-Host ""
Write-Host "=== Fixing Grade 1 Schema A blocks ==="

# ============================================================
# GRADE 1: Schema A blocks have block-level answer field
# We need to: add correct_answer if missing, add explanation_th
# ============================================================

$g1Files = Get-ChildItem "$base\grade_1\lessons" -Filter "*.json"

foreach ($f in $g1Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedCount = 0

    # Find all mini_quiz blocks using double-space pattern
    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    
    $matchArray = @()
    foreach ($m in $matches) { $matchArray += $m }
    
    $indexOffset = 0
    
    for ($idx = 0; $idx -lt $matchArray.Count; $idx++) {
        $m = $matchArray[$idx]
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
        
        # Check if Schema A (no data.questions array)
        $isSchemaA = -not ($block -match '"data":\s*\{' -and $block -match '"questions":\s*\[')
        $hasAnswer = $block -match '"answer":\s*"'
        $hasCorrectAnswer = $block -match '"correct_answer":\s*"'
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaA) {
            $newBlock = $block
            
            # Add correct_answer if missing (copy from answer)
            if ($hasAnswer -and -not $hasCorrectAnswer) {
                # Find the answer value and add correct_answer after it
                $answerMatch = [regex]::Match($newBlock, '"answer":\s*"([^"]+)"')
                if ($answerMatch.Success) {
                    $answerVal = $answerMatch.Groups[1].Value
                    $insertStr = "`n    ""correct_answer"": ""$answerVal"""
                    $newBlock = $newBlock.Insert($answerMatch.Index + $answerMatch.Length, $insertStr)
                }
            }
            
            # Add explanation_th if missing
            if (-not $hasExplTH) {
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

    "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "}"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
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
Write-Host "Grade 1 Schema A fixed: $($fixedFiles.Count) files"
Write-Host ""
Write-Host "=== Fixing Grade 2 Schema A (last block in each variant) ==="

# ============================================================
# GRADE 2: Schema A blocks (last mini_quiz in each variant)
# ============================================================

$g2Files2 = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files2) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedCount = 0

    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    
    $matchArray = @()
    foreach ($m in $matches) { $matchArray += $m }
    
    $indexOffset = 0
    
    for ($idx = 0; $idx -lt $matchArray.Count; $idx++) {
        $m = $matchArray[$idx]
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
        
        $isSchemaA = -not ($block -match '"data":\s*\{' -and $block -match '"questions":\s*\[')
        $hasAnswer = $block -match '"answer":\s*"'
        $hasCorrectAnswer = $block -match '"correct_answer":\s*"'
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isSchemaA) {
            $newBlock = $block
            
            if ($hasAnswer -and -not $hasCorrectAnswer) {
                $answerMatch = [regex]::Match($newBlock, '"answer":\s*"([^"]+)"')
                if ($answerMatch.Success) {
                    $answerVal = $answerMatch.Groups[1].Value
                    $insertStr = "`n    ""correct_answer"": ""$answerVal"""
                    $newBlock = $newBlock.Insert($answerMatch.Index + $answerMatch.Length, $insertStr)
                }
            }
            
            if (-not $hasExplTH) {
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

    "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "}"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
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
Write-Host "Grade 2 Schema A fixed: $($fixedFiles.Count) files"
Write-Host ""
Write-Host "=== Fixing Grade 4 Schema A explanation_th ==="

# ============================================================
# GRADE 4: Schema A blocks (content.questions[]) - check explanation_th
# ============================================================

$g4Files = Get-ChildItem "$base\grade_4\lessons" -Filter "*.json"

foreach ($f in $g4Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedCount = 0

    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    
    $matchArray = @()
    foreach ($m in $matches) { $matchArray += $m }
    
    $indexOffset = 0
    
    for ($idx = 0; $idx -lt $matchArray.Count; $idx++) {
        $m = $matchArray[$idx]
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
        
        # Check if has content.questions (Grade 4 Schema A)
        $isG4SchemaA = $block -match '"content":\s*\{' -and $block -match '"questions":\s*\['
        $hasExplTH = $block -match 'explanation_th'
        
        if ($isG4SchemaA -and -not $hasExplTH) {
            $lastBrace = $block.LastIndexOf('}')
            $insertStr = @"

    "explanation_th": "See correct answer above"
"@
            $newBlock = $block.Substring(0, $lastBrace) + $insertStr + "}"
            $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
            $indexOffset += ($newBlock.Length - $blockLen)
            $fixedCount++
        }
    }
    
    if ($fixedCount -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedCount blocks"
        Write-Host "Fixed: $($f.Name) - $fixedCount blocks"
    }
}

Write-Host ""
Write-Host "Grade 4 Schema A fixed: $($fixedFiles.Count) files"
Write-Host ""
Write-Host "Total fixed files: $($fixedFiles.Count)"