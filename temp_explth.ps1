# Robust mini_quiz extractor - handles nested braces
function Get-MiniQuizBlocks($content) {
    $blocks = @()
    $pattern = '(?s)"type":\s*"mini_quiz"'
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $start = $m.Index
        # Find the opening brace after "mini_quiz"
        $braceStart = $content.IndexOf('{', $m.Index)
        if ($braceStart -eq -1) { continue }
        # Count braces to find matching close
        $depth = 0
        $i = $braceStart
        $blockEnd = $braceStart
        for (; $i -lt $content.Length; $i++) {
            if ($content[$i] -eq '{') { $depth++ }
            elseif ($content[$i] -eq '}') { 
                $depth--
                if ($depth -eq 0) { $blockEnd = $i; break }
            }
        }
        $block = $content.Substring($start, $blockEnd - $start + 1)
        $blocks += $block
    }
    return $blocks
}

# Check files for missing explanation_th in Schema B mini_quiz blocks
$base = "D:\web app\4-craft.com\apps\api\app\content\math"
$files = @(
    "$base\grade_2\lessons\g2_add_two_digit.json",
    "$base\grade_2\lessons\g2_money_change.json",
    "$base\grade_2\lessons\g2_multiplication_intro.json",
    "$base\grade_2\lessons\g2_shapes_2d.json",
    "$base\grade_2\lessons\g2_subtract_two_digit.json",
    "$base\grade_2\lessons\g2_times_table_2_5_10.json",
    "$base\grade_2\lessons\g2_time_calendar.json"
)
foreach ($f in $files) {
    $c = Get-Content $f -Raw
    $blocks = Get-MiniQuizBlocks $c
    $missingExplTH = 0
    $hasExplTH = 0
    foreach ($b in $blocks) {
        if ($b -match 'explanation_th') { $hasExplTH++ }
        else { $missingExplTH++ }
    }
    "$($f.Split('\')[-1]): blocks=$($blocks.Count) hasExplTH=$hasExplTH missingExplTH=$missingExplTH"
}