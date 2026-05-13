# Fix using byte-exact matching for multiplication files
$ErrorActionPreference = "Continue"
$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

# Use [char] to build the actual strings with proper UTF-8 encoding
$timesChar = [char]0x00D7  # × MULTIPLICATION SIGN

function Fix-JsonFile {
    param([string]$FilePath, [hashtable]$FixMap)
    
    $jsonText = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $j = $jsonText | ConvertFrom-Json
    
    $fixedCount = 0
    
    if ($j.lesson_variants) {
        foreach ($variant in $j.lesson_variants) {
            if ($variant.visual_blocks) {
                foreach ($block in $variant.visual_blocks) {
                    if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                        for ($i = 0; $i -lt $block.data.questions.Count; $i++) {
                            $q = $block.data.questions[$i]
                            
                            if ($null -ne $q.correct_answer -and $q.correct_answer -ne "") {
                                continue
                            }
                            
                            $qText = $q.text_th
                            if (-not $qText) { continue }
                            
                            $matched = $false
                            foreach ($key in $FixMap.Keys) {
                                if ($qText.StartsWith($key)) {
                                    $fix = $FixMap[$key]
                                    $q.choices = $fix.Choices
                                    $q.answer = $fix.Answer
                                    $q.correct_answer = $fix.Answer
                                    $fixedCount++
                                    Write-Host "  Fixed $($variant.variant_id) Q[$($i+1)]: $($qText) -> $($fix.Answer)"
                                    $matched = $true
                                    break
                                }
                            }
                            
                            if (-not $matched) {
                                Write-Host "  UNHANDLED: $($variant.variant_id) Q[$($i+1)]: $($qText)"
                            }
                        }
                    }
                }
            }
        }
    }
    
    if ($fixedCount -gt 0) {
        $newJson = $j | ConvertTo-Json -Depth 30
        [System.IO.File]::WriteAllText($FilePath, $newJson, [System.Text.Encoding]::UTF8)
        Write-Host "  Saved $fixedCount fixes"
        return $fixedCount
    }
    return 0
}

$totalFixes = 0
$filesEdited = @()

# g2_multiplication_intro.json
Write-Host "=== g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
$fixMap = @{}
$fixMap["5$($timesChar)6 = ?"] = @{ Answer = "30"; Choices = @("28", "29", "30", "31") }
$fixMap["2$($timesChar)7 = ?"] = @{ Answer = "14"; Choices = @("12", "13", "14", "15") }
$f = Fix-JsonFile -FilePath $fp -FixMap $fixMap
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# g2_times_table_2_5_10.json
Write-Host "=== g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
$fixMap = @{}
$fixMap["4$($timesChar)2 = ?"] = @{ Answer = "8"; Choices = @("6", "7", "8", "9") }
$fixMap["9$($timesChar)2 = ?"] = @{ Answer = "18"; Choices = @("16", "17", "18", "19") }
$fixMap["4$($timesChar)5 = ?"] = @{ Answer = "20"; Choices = @("18", "19", "20", "21") }
$fixMap["9$($timesChar)5 = ?"] = @{ Answer = "45"; Choices = @("43", "44", "45", "46") }
$fixMap["4$($timesChar)10 = ?"] = @{ Answer = "40"; Choices = @("38", "39", "40", "41") }
$fixMap["9$($timesChar)10 = ?"] = @{ Answer = "90"; Choices = @("88", "89", "90", "91") }
$f = Fix-JsonFile -FilePath $fp -FixMap $fixMap
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

Write-Host ""
Write-Host "Total fixes: $totalFixes" -ForegroundColor Green
Write-Host "Files edited: $($filesEdited.Count)"