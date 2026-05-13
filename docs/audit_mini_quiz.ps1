$files = Get-ChildItem "D:\web app\4-craft.com\apps\api\app\content\math" -Filter "*.json" -Recurse
$issues = @()

foreach ($f in $files) {
    try {
        $j = Get-Content $f.FullName -Raw | ConvertFrom-Json
        if ($j.lessons) {
            foreach ($lesson in $j.lessons) {
                if ($lesson.blocks) {
                    for ($i = 0; $i -lt $lesson.blocks.Count; $i++) {
                        $b = $lesson.blocks[$i]
                        if ($b.mini_quiz -and $b.mini_quiz.questions) {
                            $qIndex = 0
                            foreach ($q in $b.mini_quiz.questions) {
                                $prob = @()
                                $hasCorrect = $null -ne $q.correct_answer
                                $hasAnswer = $null -ne $q.answer
                                $choicesArr = $q.choices -is [System.Array]
                                $choicesCount = if ($choicesArr) { $q.choices.Count } else { 0 }
                                $choicesVals = if ($choicesArr) { ($q.choices | ForEach-Object { "$_" }) -join "," } else { "NOT_ARRAY" }

                                if (-not $hasCorrect) { $prob += "missing_correct_answer" }
                                if ($q.choices -and -not $choicesArr) { $prob += "choices_not_array" }
                                if ($choicesArr -and $choicesCount -eq 0) { $prob += "choices_empty" }
                                if ($choicesArr -and $choicesCount -gt 0 -and ($q.choices | Where-Object { $_ -notin @("A","B","C","D") }).Count -eq 0) { $prob += "choices_are_ABCD" }

                                if ($prob.Count -gt 0) {
                                    $issues += [PSCustomObject]@{
                                        File = $f.FullName
                                        Lesson = $lesson.title
                                        QIndex = $qIndex
                                        Question = if ($q.question) { $q.question.Substring(0, [Math]::Min(50, $q.question.Length)) } else { "N/A" }
                                        Problems = ($prob -join ",")
                                        Answer = $q.answer
                                        CorrectAnswer = $q.correct_answer
                                        ChoicesType = if ($choicesArr) { "Array" } else { $q.choices.GetType().Name }
                                        ChoicesCount = $choicesCount
                                        ChoicesVals = $choicesVals
                                    }
                                }
                                $qIndex++
                            }
                        }
                    }
                }
            }
        }
    }
    catch {
        $issues += [PSCustomObject]@{
            File = $f.FullName
            Error = $_.Exception.Message
            Problems = "PARSE_ERROR"
        }
    }
}

$issues | Format-List * -Force | Out-String
$issues | Export-Csv -Path "D:\web app\4-craft.com\docs\mini_quiz_audit.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Total issues found: $($issues.Count)"