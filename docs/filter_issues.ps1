$data = Import-Csv "D:\web app\4-craft.com\docs\mini_quiz_issues_v2.csv"
$filtered = $data | Where-Object { 
    $_.File -notlike "*LESSON_CONTENT*" -and 
    $_.File -notlike "*QUESTION*" -and 
    $_.File -notlike "*moltbook*" 
}
$filtered | Format-Table File, Location, Problems, Question -AutoSize | Out-String
Write-Host ""
Write-Host "Total real lesson file issues: $($filtered.Count)"