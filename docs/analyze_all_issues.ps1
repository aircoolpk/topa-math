$data = Import-Csv "D:\web app\4-craft.com\docs\mini_quiz_issues_v3.csv"
$uniqueFiles = ($data | Select-Object -ExpandProperty FilePath -Unique)

foreach ($f in $uniqueFiles) {
    Write-Host "=== $f ===" -ForegroundColor Yellow
    $content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $j = $content | ConvertFrom-Json
    
    $variantIndex = 0
    foreach ($variant in $j.lesson_variants) {
        $blockIndex = 0
        foreach ($block in $variant.visual_blocks) {
            if ($block.type -eq "mini_quiz" -and $block.data.questions) {
                $qIndex = 0
                foreach ($q in $block.data.questions) {
                    if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                        $text = if ($q.text_th) { $q.text_th } else { "NO_TEXT" }
                        Write-Host "  Variant[$variantIndex] Block[$blockIndex] Q[$qIndex]: $text"
                        if ($q.choices -is [Array] -and $q.choices.Count -gt 0) {
                            Write-Host "    Choices: $($q.choices -join ', ')"
                        } else {
                            Write-Host "    Choices: MISSING"
                        }
                    }
                    $qIndex++
                }
            }
            $blockIndex++
        }
        $variantIndex++
    }
    Write-Host ""
}