# Find blocks with "answer" field but no corresponding "correct_answer" OR where answer value != correct_answer
# Also find blocks with non-list choices (choice letters, etc.)
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$answerOnlyBlocks = 0
$choiceLetterBlocks = 0
$nonListChoices = 0

Get-ChildItem "$base" -Filter "*.json" -Recurse | ForEach-Object { 
    $f = $_.FullName
    $c = Get-Content $f -Raw
    
    # Pattern 1: "answer": "X" without correct_answer in same block
    # Need to extract each block first
    $pattern = '(?s)"type":\s*"mini_quiz"'
    $matches = [regex]::Matches($c, $pattern)
    foreach ($m in $matches) {
        $braceStart = $c.IndexOf('{', $m.Index)
        if ($braceStart -eq -1) { continue }
        $depth = 0; $i = $braceStart; $blockEnd = $braceStart
        for (; $i -lt $c.Length; $i++) { 
            if ($c[$i] -eq '{') { $depth++ } 
            elseif ($c[$i] -eq '}') { $depth--; if ($depth -eq 0) { $blockEnd = $i; break } } 
        }
        $block = $c.Substring($m.Index, $blockEnd - $m.Index + 1)
        
        # Check if block has "answer": but no "correct_answer":
        if ($block -match '"answer":\s*"([^"]+)"' -and $block -notmatch 'correct_answer') {
            $answerOnlyBlocks++
            Write-Host "ANSWER_ONLY_NO_CORRECT: $($_.Name) answer=$($matches[1])"
        }
        
        # Check for choice letters: "choices": ["A","B","C","D"]
        if ($block -match '"choices":\s*\[\s*"[A-D]"(?:\s*,\s*"[A-D]"){3}\s*\]') {
            $choiceLetterBlocks++
            Write-Host "CHOICE_LETTERS: $($_.Name)"
        }
        
        # Check for non-array choices (not a proper list)
        if ($block -match '"choices":\s*\[(?!\s*\])') {
            # Has choices but need to check if it's an empty array or non-list
            if ($block -notmatch '"choices":\s*\[\s*"[^"]+"(?:\s*,\s*"[^"]+")*\s*\]') {
                # Choices exist but not a proper string list
                if ($block -match '"choices":\s*\[\s*\]') {
                    $nonListChoices++
                    Write-Host "EMPTY_CHOICES: $($_.Name)"
                }
            }
        }
    }
}

Write-Host ""
Write-Host "SUMMARY:" -ForegroundColor Cyan
Write-Host "answer_only_no_correct: $answerOnlyBlocks"
Write-Host "choice_letter_blocks: $choiceLetterBlocks"  
Write-Host "empty_choices: $nonListChoices"