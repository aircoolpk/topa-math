$c = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_money_change.json" -Raw
$parts = $c -split '(?s)"type":\s*"mini_quiz"'
$block = '"type": "mini_quiz"' + $parts[1]
$start = $block.IndexOf('"questions":  [')
$end = $block.IndexOf(']', $start)
$qContent = $block.Substring($start + 14, $end - $start - 14)
"Questions raw (first 500): $($qContent.Substring(0, [Math]::Min(500, $qContent.Length)))"
""
"Entries:"
$entries = [regex]::Matches($qContent, '(?s)\{([^{}]*)\}')
"Total: $($entries.Count)"
foreach ($e in $entries) {
    $hasCA = ($e.Value -match 'correct_answer')
    "correct_answer=$hasCA | $($e.Value.Substring(0, [Math]::Min(80, $e.Value.Length)))"
}