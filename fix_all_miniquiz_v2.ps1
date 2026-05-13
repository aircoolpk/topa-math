# Fix mini_quiz schema issues - targeted fix for questions WITH choices/answer
# Uses direct string replacement, NOT ConvertFrom-Json for modifications

$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()

# ============================================================
# GRADE 2: Schema B - questions with choices but no correct_answer
# Pattern: "answer": "VALUE" followed by closing brace/bracket
# ============================================================

Write-Host "=== Fixing Grade 2 Schema B ==="
$g2Files = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    
    # Find mini_quiz blocks with data.questions
    $matches = [regex]::Matches($c, '"type":  "mini_quiz"')
    $matchArray = @()
    foreach ($m in $matches) { $matchArray += $m }
    
    $indexOffset = 0
    $fixedInFile = 0
    
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
        
        # Check if Schema B (has data.questions)
        $isSchemaB = $block -match '"data":\s*\{' -and $block -match '"questions":\s*\['
        
        if ($isSchemaB) {
            # Find the questions array
            $dataIdx = $block.IndexOf('"data":')
            $questionsIdx = $block.IndexOf('"questions":', $dataIdx)
            $arrStart = $block.IndexOf('[', $questionsIdx)
            $arrEnd = $block.LastIndexOf(']')
            $questionsSection = $block.Substring($arrStart, $arrEnd - $arrStart + 1)
            
            # Find questions with "answer" field but no "correct_answer"
            # Pattern: "answer": "X" followed by newline and closing brace/bracket (not "correct_answer")
            $answerPattern = '"answer":\s*"([^"]+)""'
            $answerMatches = [regex]::Matches($questionsSection, $answerPattern)
            
            $blockOffset = 0
            foreach ($am in $answerMatches) {
                $answerVal = $am.Groups[1].Value
                $posInQ = $am.Index + $blockOffset
                
                # Check what follows this answer
                $afterAnswer = $questionsSection.Substring($am.Index + $am.Length)
                $nextChars = $afterAnswer.Substring(0, [Math]::Min(50, $afterAnswer.Length))
                
                # Only fix if not followed by correct_answer
                if ($nextChars -notmatch '"correct_answer"') {
                    # Insert correct_answer after the answer field
                    # The answer field ends with `"VALUE"` - insert after the closing quote
                    $insertStr = ",`n                ""correct_answer"": ""$answerVal"""
                    $oldLen = $questionsSection.Length
                    $questionsSection = $questionsSection.Substring(0, $am.Index + $am.Length) + $insertStr + $questionsSection.Substring($am.Index + $am.Length)
                    $blockOffset += $insertStr.Length
                }
            }
            
            # Also add explanation_th at block level if missing
            if ($block -notmatch 'explanation_th') {
                $lastBrace = $block.LastIndexOf('}')
                $insertStr = @"

                                                          "explanation_th": "See correct answer above"
"@
                $questionsSection = $questionsSection + $insertStr
            }
            
            # Reconstruct the block
            $beforeQuestions = $block.Substring(0, $arrStart)
            $afterQuestions = $block.Substring($arrEnd + 1)
            $newBlock = $beforeQuestions + $questionsSection + $afterQuestions
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
                $fixedInFile++
            }
        }
    }
    
    if ($fixedInFile -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedInFile blocks"
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "=== Fixing Grade 1 Schema A ==="

# ============================================================
# GRADE 1: Schema A blocks - add correct_answer and explanation_th
# ============================================================

$g1Files = Get-ChildItem "$base\grade_1\lessons" -Filter "*.json"

foreach ($f in $g1Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedInFile = 0
    
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
        
        # Check if Schema A (no data.questions)
        $isSchemaA = -not ($block -match '"data":\s*\{' -and $block -match '"questions":\s*\[')
        
        if ($isSchemaA) {
            $newBlock = $block
            
            # Add correct_answer if has answer but not correct_answer
            if ($block -match '"answer":\s*"' -and $block -notmatch '"correct_answer":\s*"') {
                $answerMatch = [regex]::Match($block, '"answer":\s*"([^"]+)"')
                if ($answerMatch.Success) {
                    $answerVal = $answerMatch.Groups[1].Value
                    $insertStr = ",`n    ""correct_answer"": ""$answerVal"""
                    $newBlock = $newBlock.Insert($answerMatch.Index + $answerMatch.Length, $insertStr)
                }
            }
            
            # Add explanation_th if missing
            if ($newBlock -notmatch 'explanation_th') {
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

    "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "}"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
                $fixedInFile++
            }
        }
    }
    
    if ($fixedInFile -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedInFile blocks"
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "=== Fixing Grade 2 Schema A (last block) ==="

# ============================================================
# GRADE 2: Schema A blocks (the last mini_quiz in each file)
# ============================================================

$g2Files2 = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files2) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedInFile = 0
    
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
        
        if ($isSchemaA) {
            $newBlock = $block
            
            if ($block -match '"answer":\s*"' -and $block -notmatch '"correct_answer":\s*"') {
                $answerMatch = [regex]::Match($block, '"answer":\s*"([^"]+)"')
                if ($answerMatch.Success) {
                    $answerVal = $answerMatch.Groups[1].Value
                    $insertStr = ",`n    ""correct_answer"": ""$answerVal"""
                    $newBlock = $newBlock.Insert($answerMatch.Index + $answerMatch.Length, $insertStr)
                }
            }
            
            if ($newBlock -notmatch 'explanation_th') {
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

    "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "}"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
                $fixedInFile++
            }
        }
    }
    
    if ($fixedInFile -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedInFile blocks"
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "=== Fixing Grade 4 Schema A explanation_th ==="

# ============================================================
# GRADE 4: Schema A blocks with content.questions - add explanation_th
# ============================================================

$g4Files = Get-ChildItem "$base\grade_4\lessons" -Filter "*.json"

foreach ($f in $g4Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedInFile = 0
    
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
        
        # Check if Grade 4 Schema A (has content.questions)
        $isG4SchemaA = $block -match '"content":\s*\{' -and $block -match '"questions":\s*\['
        
        if ($isG4SchemaA -and $block -notmatch 'explanation_th') {
            $lastBrace = $block.LastIndexOf('}')
            $insertStr = @"

    "explanation_th": "See correct answer above"
"@
            $newBlock = $block.Substring(0, $lastBrace) + $insertStr + "}"
            $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
            $indexOffset += ($newBlock.Length - $blockLen)
            $fixedInFile++
        }
    }
    
    if ($fixedInFile -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        $fixedFiles += "$($f.Name): $fixedInFile blocks"
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "Total fixed files: $($fixedFiles.Count)"