# Fix mini_quiz schema issues using direct string replacement
# DO NOT use ConvertFrom-Json for modifications

$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$fixedFiles = @()

Write-Host "=== Fixing Grade 2 Schema B blocks ==="

$g2Files = Get-ChildItem "$base\grade_2\lessons" -Filter "*.json"

foreach ($f in $g2Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    
    # Find mini_quiz blocks
    $matches = [regex]::Matches($c, '"type": "mini_quiz"')
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
            # Find the questions array using bracket depth
            $dataIdx = $block.IndexOf('"data":')
            $questionsIdx = $block.IndexOf('"questions":', $dataIdx)
            $arrStart = $block.IndexOf('[', $questionsIdx)
            
            $depth = 0
            for ($i = $arrStart; $i -lt $block.Length; $i++) {
                if ($block[$i] -eq '[') { $depth++ }
                elseif ($block[$i] -eq ']') { $depth--; if ($depth -eq 0) { $arrEnd = $i; break } }
            }
            
            $questionsSection = $block.Substring($arrStart, $arrEnd - $arrStart + 1)
            $beforeQuestions = $block.Substring(0, $arrStart)
            $afterQuestions = $block.Substring($arrEnd + 1)
            
            # Process each question object in the questions array
            # We need to find individual question objects and add correct_answer
            
            $newQS = $questionsSection
            $offset = 0
            
            # Find all "text_th" positions to identify question boundaries
            $textMatches = [regex]::Matches($questionsSection, '"text_th":\s*"([^"]+)"')
            
            for ($qi = 0; $qi -lt $textMatches.Count; $qi++) {
                $textPos = $textMatches[$qi].Index
                $textVal = $textMatches[$qi].Groups[1].Value
                
                # Find end of this question object
                $afterText = $questionsSection.Substring($textPos)
                $objEnd = $afterText.IndexOf('},')
                $objEndBracket = $afterText.IndexOf(']')
                if ($objEnd -eq -1 -or ($objEndBracket -ne -1 -and $objEndBracket -lt $objEnd)) {
                    $objEnd = $objEndBracket
                }
                
                $objContent = $afterText.Substring(0, $objEnd)
                $objEndGlobal = $textPos + $objEnd
                
                # Check if this question has "answer" but no "correct_answer"
                $hasAnswer = $objContent -match '"answer":\s+"([^"]+)"'
                $hasCorrectAnswer = $objContent -match '"correct_answer":\s+"([^"]*)"'
                
                if ($hasAnswer -and -not $hasCorrectAnswer) {
                    # Get the answer value
                    $answerMatch = [regex]::Match($objContent, '"answer":\s+"([^"]+)"')
                    if ($answerMatch.Success) {
                        $answerVal = $answerMatch.Groups[1].Value
                        $insertPos = $objEndGlobal + $offset
                        $insertStr = ",`n                ""correct_answer"": ""$answerVal"""
                        $newQS = $newQS.Substring(0, $insertPos) + $insertStr + $newQS.Substring($insertPos)
                        $offset += $insertStr.Length
                    }
                }
                
                # Check if this question has NO choices/answer (computation question)
                # and needs to be converted to a choice-based question
                $hasChoices = $objContent -match '"choices":\s*\['
                if (-not $hasChoices -and -not $objContent -match '"answer":') {
                    # This is a computation question - we need to add choices
                    # Parse math expression from text_th
                    # Pattern: "XX + YY = ?" or "XX - YY = ?"
                    $mathMatch = [regex]::Match($textVal, '(\d+)\s*([+\-xX*])\s*(\d+)\s*=')
                    if ($mathMatch.Success) {
                        $num1 = [int]$mathMatch.Groups[1].Value
                        $op = $mathMatch.Groups[2].Value
                        $num2 = [int]$mathMatch.Groups[3].Value
                        
                        if ($op -eq "+") { $correct = $num1 + $num2 }
                        elseif ($op -eq "-" -or $op -eq "x" -or $op -eq "X" -or $op -eq "*") { 
                            $correct = if ($op -eq "-") { $num1 - $num2 } else { $num1 * $num2 }
                        }
                        
                        # Generate wrong choices
                        $wrong1 = $correct + 1
                        $wrong2 = $correct - 1
                        if ($wrong2 -lt 0) { $wrong2 = $correct + 2 }
                        $wrong3 = $correct + 2
                        
                        # Insert choices before the closing brace
                        $bracePos = $objEndGlobal + $offset - 1  # position of closing }
                        $insertStr = @"

                "choices": [
                  "$wrong2",
                  "$wrong1",
                  "$correct",
                  "$wrong3"
                ],
                "answer": "$correct",
                "correct_answer": "$correct"
"@
                        $newQS = $newQS.Substring(0, $bracePos) + $insertStr + $newQS.Substring($bracePos)
                        $offset += $insertStr.Length
                    }
                }
            }
            
            # Add explanation_th at block level if missing
            $newBlock = $beforeQuestions + $newQS + $afterQuestions
            if ($newBlock -notmatch 'explanation_th') {
                $lastBrace = $newBlock.LastIndexOf('}')
                $insertStr = @"

                                                          "explanation_th": "See correct answer above"
"@
                $newBlock = $newBlock.Substring(0, $lastBrace) + $insertStr + "                                                      }"
            }
            
            if ($newBlock -ne $block) {
                $c = $c.Substring(0, $startIdx) + $newBlock + $c.Substring($startIdx + $blockLen)
                $indexOffset += ($newBlock.Length - $blockLen)
                $fixedInFile++
            }
        } else {
            # Schema A block - add correct_answer and explanation_th if missing
            $newBlock = $block
            
            if ($block -match '"answer":\s+"' -and $block -notmatch '"correct_answer":\s+"') {
                $answerMatch = [regex]::Match($block, '"answer":\s+"([^"]+)"')
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
        $fixedFiles += $f.Name
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "=== Fixing Grade 1 Schema A blocks ==="

$g1Files = Get-ChildItem "$base\grade_1\lessons" -Filter "*.json"

foreach ($f in $g1Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedInFile = 0
    
    $matches = [regex]::Matches($c, '"type": "mini_quiz"')
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
            
            if ($block -match '"answer":\s+"' -and $block -notmatch '"correct_answer":\s+"') {
                $answerMatch = [regex]::Match($block, '"answer":\s+"([^"]+)"')
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
        $fixedFiles += $f.Name
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "=== Fixing Grade 4 Schema A explanation_th ==="

$g4Files = Get-ChildItem "$base\grade_4\lessons" -Filter "*.json"

foreach ($f in $g4Files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    $fixedInFile = 0
    
    $matches = [regex]::Matches($c, '"type": "mini_quiz"')
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
        $fixedFiles += $f.Name
        Write-Host "Fixed: $($f.Name) - $fixedInFile blocks"
    }
}

Write-Host ""
Write-Host "Total fixed files: $($fixedFiles.Count)"