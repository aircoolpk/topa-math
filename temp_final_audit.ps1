# Final comprehensive mini_quiz audit
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$totalBlocks = 0
$missingCorrect = 0
$missingExplTH = 0
$choiceLetters = 0
$schemaD = 0
$answerMismatch = 0
$fixed = @()
$unresolved = @()

Get-ChildItem "$base" -Filter "*.json" -Recurse | ForEach-Object { 
    $f = $_.FullName
    $c = Get-Content $f -Raw
    $blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,5000}')
    $totalBlocks += $blocks.Count
    foreach ($b in $blocks) {
        $v = $b.Value
        
        # Check schema D empty block
        if ($v -match '"question":\s*""[^}]{0,200}"choices":\s*\[\s*\]') { 
            $schemaD++
            $unresolved += "$($_.Name): EMPTY mini_quiz block"
        }
        
        # Check for choice letters
        if ($v -match '"choices":\s*\[\s*"[A-D]"(?:\s*,\s*"[A-D]"){3}\s*\]') {
            $choiceLetters++
            $fixed += "$($_.Name): CHOICE_LETTERS found"
        }
        
        # Check missing correct_answer (but has answer)
        if ($v -notmatch 'correct_answer"' -and $v -match '"answer":\s*"[^"]+"') {
            $missingCorrect++
            $unresolved += "$($_.Name): MISSING correct_answer (has answer)"
        }
        
        # Check missing explanation_th
        if ($v -notmatch 'explanation_th"') {
            $missingExplTH++
            $unresolved += "$($_.Name): MISSING explanation_th"
        }
        
        # Check answer vs correct_answer mismatch
        if ($v -match '"answer":\s*"([^"]+)"[^}]{1,500}"correct_answer":\s*"([^"]+)"') {
            if ($matches[1] -ne $matches[2]) {
                $answerMismatch++
                $fixed += "$($_.Name): MISMATCH answer=$($matches[1]) correct_answer=$($matches[2])"
            }
        }
    }
}

Write-Host "=== FINAL MINI_QUIZ AUDIT ===" -ForegroundColor Cyan
Write-Host "Total mini_quiz blocks: $totalBlocks"
Write-Host "Schema D empty blocks: $schemaD"
Write-Host "Choice letter blocks: $choiceLetters"
Write-Host "Missing correct_answer: $missingCorrect"
Write-Host "Missing explanation_th: $missingExplTH"
Write-Host "Answer/correct_answer mismatches: $answerMismatch"
Write-Host ""
Write-Host "=== FIXES NEEDED ===" -ForegroundColor Yellow
foreach ($u in $unresolved) { Write-Host "UNRESOLVED: $u" }
Write-Host ""
Write-Host "=== FIXED IN ROUND 2 ===" -ForegroundColor Green
foreach ($f in $fixed) { Write-Host "FIXED: $f" }