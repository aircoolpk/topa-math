# Schema Analysis for ALL mini_quiz blocks
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
Get-ChildItem "$base" -Filter "*.json" -Recurse | ForEach-Object { 
    $f = $_.FullName
    $c = Get-Content $f -Raw
    # Find all mini_quiz blocks
    $blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,4000}')
    foreach ($b in $blocks) {
        $block = $b.Value
        $missingCorrect = ($block -notmatch 'correct_answer"' -and $block -match '"answer":\s*"[^"]+"')
        $hasChoiceLetters = ($block -match '"choices":\s*\[\s*"[A-D]"(?:\s*,\s*"[A-D]"){3}\s*\]')
        $schemaD = ($block -match '"question":\s*""[^}]{0,200}"choices":\s*\[\s*\]')
        
        if ($missingCorrect) {
            Write-Host "MISSING_CORRECT: $f block_len=$($block.Length)"
        }
        if ($hasChoiceLetters) {
            Write-Host "CHOICE_LETTERS: $f block_len=$($block.Length)"
        }
        if ($schemaD) {
            Write-Host "SCHEMA_D_EMPTY: $f block_len=$($block.Length)"
        }
    }
}