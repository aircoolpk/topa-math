# Fix mini_quiz by first 10 chars of question text - ASCII-safe keys
$ErrorActionPreference = "Continue"
$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

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
                                if ($qText.Length -ge 10 -and $key.Length -ge 10) {
                                    if ($qText.Substring(0, 10) -eq $key.Substring(0, 10)) {
                                        $fix = $FixMap[$key]
                                        $q.choices = $fix.Choices
                                        $q.answer = $fix.Answer
                                        $q.correct_answer = $fix.Answer
                                        $fixedCount++
                                        Write-Host "  Fixed $($variant.variant_id) Q[$($i+1)]: $($qText.Substring(0, [Math]::Min(20, $qText.Length)))... -> $($fix.Answer)"
                                        $matched = $true
                                        break
                                    }
                                }
                            }
                            
                            if (-not $matched) {
                                Write-Host "  UNHANDLED: $($variant.variant_id) Q[$($i+1)]: $($qText.Substring(0, [Math]::Min(20, $qText.Length)))..."
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

# g2_money_change.json - "ซื้อของ 44" -> 56
Write-Host "=== g2_money_change.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_money_change.json"
# First 10 chars of "ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?"
$fixMap = @{
    [char][]::{char[117]::Substring(0,10)} = @{ Answer = "56"; Choices = @("54", "55", "56", "57") }
}

Write-Host "Key1 from file: $key1"
$fixMap2 = @{}
$fixMap2[$key1] = @{ Answer = "56"; Choices = @("54", "55", "56", "57") }
$f = Fix-JsonFile -FilePath $fp -FixMap $fixMap2
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# g2_multiplication_intro.json
Write-Host "=== g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
# These use × (multiplication sign) - first 10 chars: "5 × 6 = ?"
$fixMap3 = @{}
$fixMap3["5 × 6 = ?"] = @{ Answer = "30"; Choices = @("28", "29", "30", "31") }
$fixMap3["2 × 7 = ?"] = @{ Answer = "14"; Choices = @("12", "13", "14", "15") }
$f = Fix-JsonFile -FilePath $fp -FixMap $fixMap3
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# g2_times_table_2_5_10.json
Write-Host "=== g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
$fixMap4 = @{}
$fixMap4["4 × 2 = ?"] = @{ Answer = "8"; Choices = @("6", "7", "8", "9") }
$fixMap4["9 × 2 = ?"] = @{ Answer = "18"; Choices = @("16", "17", "18", "19") }
$fixMap4["4 × 5 = ?"] = @{ Answer = "20"; Choices = @("18", "19", "20", "21") }
$fixMap4["9 × 5 = ?"] = @{ Answer = "45"; Choices = @("43", "44", "45", "46") }
$fixMap4["4 × 10 ="] = @{ Answer = "40"; Choices = @("38", "39", "40", "41") }
$fixMap4["9 × 10 ="] = @{ Answer = "90"; Choices = @("88", "89", "90", "91") }
$f = Fix-JsonFile -FilePath $fp -FixMap $fixMap4
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

Write-Host ""
Write-Host "Total fixes: $totalFixes" -ForegroundColor Green
Write-Host "Files edited: $($filesEdited.Count)"