# Deep dive on g4 files - check for Schema C (answer_th instead of correct_answer)
$files = @(
    "D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_fractions.json",
    "D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json"
)
foreach ($f in $files) {
    $c = Get-Content $f -Raw
    $blocks = [regex]::Matches($c, '(?s)"type":\s*"mini_quiz"[^}]{10,5000}')
    Write-Host "=== $($f.Split('\')[-1]) ==="
    Write-Host "Total blocks: $($blocks.Count)"
    foreach ($b in $blocks) {
        $v = $b.Value
        $hasAnswerTH = ($v -match 'answer_th')
        $hasCorrectAnswer = ($v -match 'correct_answer')
        $hasContent = ($v -match '"content":')
        $schema = "?"
        if ($hasContent) { $schema = "C" }
        elseif ($v -match '"data":\s*\{') { $schema = "B" }
        elseif ($v -match '"question":\s*""') { $schema = "D" }
        elseif ($hasAnswerTH) { $schema = "C" }
        else { $schema = "A" }
        Write-Host "  schema=$schema hasAnswerTH=$hasAnswerTH hasCorrectAnswer=$hasCorrectAnswer len=$($v.Length)"
        # Show first 200 chars of each block
        Write-Host "  PREVIEW: $($v.Substring(0, [Math]::Min(200, $v.Length)))"
        Write-Host ""
    }
}