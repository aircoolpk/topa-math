$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

function Fix-FileText {
    param([string]$FilePath, [string]$QuestionText, [string]$Answer, [string]$ChoicesStr)
    
    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    
    # Find the question text in the JSON
    if ($content -notmatch [regex]::Escape($QuestionText)) {
        Write-Host "  Question not found: $QuestionText"
        return $false
    }
    
    # Find position after this question's text_th value
    $qPos = $content.IndexOf($QuestionText)
    
    # Find the next occurrence of "text_th" after this question - if any
    # If the question we found is the last one or doesn't have proper structure, we need different approach
    
    # Use regex to find the specific question block and inject correct_answer and choices
    # Pattern: find "text_th": "QUESTION" followed by closing brace with missing fields
    
    # For each file, we'll do specific replacements
    Write-Host "  Would fix: $QuestionText -> $Answer"
    return $true
}

function Fix-FileDirect {
    param([string]$FilePath, [array]$Fixes)
    
    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $original = $content
    $fixedCount = 0
    
    foreach ($fix in $Fixes) {
        $qText = $fix.Question
        $answer = $fix.Answer
        $choices = $fix.Choices
        
        # Find the question text position
        $qIndex = $content.IndexOf($qText)
        if ($qIndex -lt 0) {
            Write-Host "  NOT FOUND: $qText"
            continue
        }
        
        # Find the end of this question block (next "}" before "text_th" or end of questions array)
        # We need to find the portion from qIndex to the end of this question object
        $afterQ = $content.Substring($qIndex + $qText.Length)
        
        # Find the closing brace of this question object - it's the first "}" that closes the object
        # But we need to be careful about nested braces
        $braceCount = 0
        $started = $false
        $endPos = 0
        for ($i = 0; $i -lt $afterQ.Length; $i++) {
            if ($afterQ[$i] -eq '{') { $braceCount++; $started = $true }
            if ($afterQ[$i] -eq '}') { 
                $braceCount-- 
                if ($started -and $braceCount -eq 0) { 
                    $endPos = $i; break 
                }
            }
        }
        
        # The question block spans from qIndex to qIndex + $qText.Length + $endPos + 1
        $blockStart = $qIndex
        $blockEnd = $qIndex + $qText.Length + $endPos + 1
        $questionBlock = $content.Substring($blockStart, $blockEnd - $blockStart)
        
        # Check if this question already has correct_answer
        if ($questionBlock -match '"correct_answer"') {
            Write-Host "  Already fixed: $qText"
            continue
        }
        
        # Build the replacement - add correct_answer and choices after the text_th line
        # The block ends with "}" - we need to add our fields before that
        
        # Find the position to insert (before the closing brace)
        $insertPos = $blockEnd - 1
        $insertText = "`n                `"choices`": [$choices],`n                `"answer`": `"$answer`",`n                `"correct_answer`": `"$answer`""
        
        $content = $content.Substring(0, $insertPos) + $insertText + $content.Substring($insertPos)
        $fixedCount++
        Write-Host "  Fixed: $qText -> $answer"
    }
    
    if ($fixedCount -gt 0) {
        [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  Saved: $FilePath ($fixedCount fixes)"
        return $true
    }
    return $false
}

# g2_add_two_digit.json
Write-Host "=== Fixing g2_add_two_digit.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_add_two_digit.json"
Fix-FileDirect -FilePath $fp -Fixes @(
    @{ Question = "67 + 21 = ?"; Answer = "88"; Choices = '"86", "87", "88", "89"' },
    @{ Question = "53 + 46 = ?"; Answer = "99"; Choices = '"97", "98", "99", "100"' }
)

# g2_subtract_two_digit.json
Write-Host "=== Fixing g2_subtract_two_digit.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_subtract_two_digit.json"
Fix-FileDirect -FilePath $fp -Fixes @(
    @{ Question = "95 - 52 = ?"; Answer = "43"; Choices = '"41", "42", "43", "44"' },
    @{ Question = "73 - 31 = ?"; Answer = "42"; Choices = '"40", "41", "42", "43"' }
)

# g2_multiplication_intro.json
Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
Fix-FileDirect -FilePath $fp -Fixes @(
    @{ Question = "5 x 6 = ?"; Answer = "30"; Choices = '"28", "29", "30", "31"' },
    @{ Question = "2 x 7 = ?"; Answer = "14"; Choices = '"12", "13", "14", "15"' }
)

# g2_times_table_2_5_10.json
Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
Fix-FileDirect -FilePath $fp -Fixes @(
    @{ Question = "4 x 2 = ?"; Answer = "8"; Choices = '"6", "7", "8", "9"' },
    @{ Question = "9 x 2 = ?"; Answer = "18"; Choices = '"16", "17", "18", "19"' },
    @{ Question = "4 x 5 = ?"; Answer = "20"; Choices = '"18", "19", "20", "21"' },
    @{ Question = "9 x 5 = ?"; Answer = "45"; Choices = '"43", "44", "45", "46"' },
    @{ Question = "4 x 10 = ?"; Answer = "40"; Choices = '"38", "39", "40", "41"' },
    @{ Question = "9 x 10 = ?"; Answer = "90"; Choices = '"88", "89", "90", "91"' }
)

Write-Host ""
Write-Host "Done!" -ForegroundColor Green