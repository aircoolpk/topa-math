$data = Import-Csv "D:\web app\4-craft.com\docs\mini_quiz_issues_v3.csv"
$uniqueQuestions = $data | Select-Object Question, Problems, File -Unique | Sort-Object Question
$uniqueQuestions | Format-Table -AutoSize | Out-String
Write-Host ""
Write-Host "Unique question types:"
$uniqueQuestions | Group-Object Question | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) occurrences across files"
}