# Find answer/correct_answer mismatches (content bugs) and all mini_quiz issues
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$issues = @()
Get-ChildItem "$base" -Filter "*.json" -Recurse | ForEach-Object { 
    $f = $_.FullName
    $c = Get-Content $f -Raw
    $blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,4000}')
    foreach ($b in $blocks) {
        $block = $b.Value
        # Check for answer != correct_answer mismatch
        if ($block -match '"answer":\s*"([^"]+)"[^}]{1,500}"correct_answer":\s*"([^"]+)"') {
            $ans = $matches[1]; $corr = $matches[2]
            if ($ans -ne $corr) {
                Write-Host "MISMATCH: $f answer='$ans' correct_answer='$corr'"
            }
        }
        # Check for Schema A blocks (have answer but no correct_answer)
        if ($block -notmatch 'correct_answer"' -and $block -match '"answer":\s*"[^"]+"' -and $block -notmatch '"data":\s*\{') {
            Write-Host "SCHEMA_A_NO_CORRECT: $f"
        }
        # Check for Schema B data.questions[] missing correct_answer
        if ($block -match '"data":\s*\{[^}]*"questions":') {
            # Extract question entries and check
            $qMatch = [regex]::Match($block, '"questions":\s*\[(.*?)\]\s*(?:\}|\},)') 
            if ($qMatch.Success) {
                $qContent = $qMatch.Groups[1].Value
                $qEntries = [regex]::Matches($qContent, '(?s)\{([^{}]{1,800})\}')
                foreach ($qe in $qEntries) {
                    $qeVal = $qe.Groups[1].Value
                    if ($qeVal -match '"text_th"' -and $qeVal -notmatch 'correct_answer') {
                        Write-Host "SCHEMA_B_ENTRY_MISSING_CORRECT: $f text=$($qeVal.Substring(0, [Math]::Min(60, $qeVal.Length)))"
                    }
                }
            }
        }
    }
}