$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math"
$docsPath = "D:\web app\4-craft.com\docs"

# Find all JSON files
$jsonFiles = Get-ChildItem -Path $mathPath -Filter "*.json" -Recurse -File

# Count total
$total = $jsonFiles.Count
Write-Host "Total JSON files: $total"

# Validate each JSON file
$validCount = 0
$invalidFiles = @()

foreach ($file in $jsonFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        $null = $content | ConvertFrom-Json -ErrorAction Stop
        $validCount++
    } catch {
        $invalidFiles += $file.FullName
    }
}

Write-Host "Valid JSON files: $validCount"
Write-Host "Invalid JSON files: $($invalidFiles.Count)"
if ($invalidFiles.Count -gt 0) {
    Write-Host "Invalid files:"
    foreach ($f in $invalidFiles) {
        Write-Host "  $f"
    }
}

# Now run mini_quiz audit
Write-Host ""
Write-Host "=== Mini Quiz Audit ===" -ForegroundColor Cyan

$issues = @()

foreach ($file in $jsonFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        $j = $content | ConvertFrom-Json
        
        # Skip fix suggestion files
        if ($file.Name -match "QUESTION|LESSON_CONTENT") { continue }
        
        # Check top-level mini_quiz
        if ($j.mini_quiz -and $j.mini_quiz.questions) {
            foreach ($q in $j.mini_quiz.questions) {
                $problem = ""
                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") { $problem += "MISSING_correct_answer; " }
                if ($null -eq $q.choices -or $q.choices -isnot [Array] -or $q.choices.Count -eq 0) { $problem += "MISSING_choices; " }
                if ($q.choices -is [Array] -and ($q.choices -join ",") -eq "A,B,C,D") { $problem += "CHOICES_ABCD; " }
                if ($problem) {
                    $issues += [PSCustomObject]@{
                        File = $file.Name
                        FilePath = $file.FullName
                        Location = "top-level mini_quiz"
                        Problems = $problem.Trim()
                        Question = $q.text_th
                    }
                }
            }
        }
        
        # Check lesson_variants
        if ($j.lesson_variants) {
            foreach ($variant in $j.lesson_variants) {
                if ($variant.visual_blocks) {
                    foreach ($block in $variant.visual_blocks) {
                        if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                            foreach ($q in $block.data.questions) {
                                $problem = ""
                                if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") { $problem += "MISSING_correct_answer; " }
                                if ($null -eq $q.choices -or $q.choices -isnot [Array] -or $q.choices.Count -eq 0) { $problem += "MISSING_choices; " }
                                if ($q.choices -is [Array] -and ($q.choices -join ",") -eq "A,B,C,D") { $problem += "CHOICES_ABCD; " }
                                if ($problem) {
                                    $issues += [PSCustomObject]@{
                                        File = $file.Name
                                        FilePath = $file.FullName
                                        Location = "lesson_variants[$($variant.variant_id)].visual_blocks[$($block.type)]"
                                        Problems = $problem.Trim()
                                        Question = $q.text_th
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "Error reading $($file.FullName): $_"
    }
}

Write-Host ""
Write-Host "Total issues found: $($issues.Count)" -ForegroundColor Yellow

# Summary by problem type
$missingCA = ($issues | Where-Object { $_.Problems -match "MISSING_correct_answer" }).Count
$missingChoices = ($issues | Where-Object { $_.Problems -match "MISSING_choices" }).Count
$abcdChoices = ($issues | Where-Object { $_.Problems -match "CHOICES_ABCD" }).Count

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Green
Write-Host "MISSING correct_answer: $missingCA"
Write-Host "MISSING/EMPTY choices: $missingChoices"
Write-Host "choices are [A,B,C,D]: $abcdChoices"

# Save to CSV
$issues | Export-Csv -Path "$docsPath\mini_quiz_audit_final.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "Audit results saved to: $docsPath\mini_quiz_audit_final.csv"

# Unique files with issues
$uniqueFiles = $issues | Select-Object -ExpandProperty FilePath -Unique
Write-Host ""
Write-Host "Files with mini_quiz issues: $($uniqueFiles.Count)"