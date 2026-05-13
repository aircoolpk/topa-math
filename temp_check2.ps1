$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json" -Raw
$blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,5000}')
"$($blocks.Count) mini_quiz blocks found"
foreach ($b in $blocks) {
    $v = $b.Value
    if ($v -match '"data":\s*\{') {
        # Extract questions array using regex
        $qMatch = [regex]::Match($v, '(?s)"questions":\s*\[(.*?)\]\s*\}')
        if ($qMatch.Success) {
            $qContent = $qMatch.Groups[1].Value
            $entries = [regex]::Matches($qContent, '(?s)\{([^{}]*)\}')
            "$($entries.Count) question entries"
            foreach ($e in $entries) {
                $hasCA = ($e.Value -match 'correct_answer')
                "$($e.Index): correct_answer=$hasCA | $($e.Value.Substring(0, [Math]::Min(100, $e.Value.Length)))"
            }
        }
    }
}