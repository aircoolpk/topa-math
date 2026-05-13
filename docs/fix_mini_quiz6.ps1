# Mini Quiz Fix Script v6 - Targeted approach
# Reads JSON as objects and modifies via JSON serialization

$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

function Fix-JsonFile {
    param([string]$FilePath, [array]$Fixes)
    
    # Read file
    $jsonText = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $j = $jsonText | ConvertFrom-Json
    
    $fixedCount = 0
    
    # Process each fix
    foreach ($fix in $Fixes) {
        $qText = $fix.Question
        $answer = $fix.Answer
        $choices = $fix.Choices
        
        # Find and fix in lesson_variants
        if ($j.lesson_variants) {
            foreach ($variant in $j.lesson_variants) {
                if ($variant.visual_blocks) {
                    foreach ($block in $variant.visual_blocks) {
                        if ($block.type -eq "mini_quiz" -and $block.data -and $block.data.questions) {
                            foreach ($q in $block.data.questions) {
                                # Match by question text (partial match for safety)
                                if ($q.text_th -and $q.text_th.Contains($qText.Substring(0, [Math]::Min(10, $qText.Length)))) {
                                    # Check if already has correct_answer
                                    if ($null -eq $q.correct_answer -or $q.correct_answer -eq "") {
                                        # Add the missing fields
                                        $q | Add-Member -NotePropertyName "choices" -NotePropertyValue ($choices -split "," | ForEach-Object { $_.Trim().Trim('"') }) -Force
                                        $q | Add-Member -NotePropertyName "answer" -NotePropertyValue $answer -Force
                                        $q | Add-Member -NotePropertyName "correct_answer" -NotePropertyValue $answer -Force
                                        $fixedCount++
                                        Write-Host "  Fixed in $($variant.variant_id): $($q.text_th.Substring(0,30))... -> $answer"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if ($fixedCount -gt 0) {
        # Save back
        $newJson = $j | ConvertTo-Json -Depth 30
        [System.IO.File]::WriteAllText($FilePath, $newJson, [System.Text.Encoding]::UTF8)
        Write-Host "  Saved: $fixedCount fixes"
    }
    
    return $fixedCount
}

$totalFixes = 0
$filesEdited = @()

# === g2_money_change.json ===
Write-Host "=== Fixing g2_money_change.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_money_change.json"
$fixes = @(
    @{ Question = "ซื้อของ 44 บาท"; Answer = "56"; Choices = '"54", "55", "56", "57"' }
)
$f = Fix-JsonFile -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# === g2_multiplication_intro.json ===
Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
$fixes = @(
    @{ Question = "5 × 6"; Answer = "30"; Choices = '"28", "29", "30", "31"' },
    @{ Question = "2 × 7"; Answer = "14"; Choices = '"12", "13", "14", "15"' }
)
$f = Fix-JsonFile -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# === g2_times_table_2_5_10.json ===
Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
$fixes = @(
    @{ Question = "4 × 2"; Answer = "8"; Choices = '"6", "7", "8", "9"' },
    @{ Question = "9 × 2"; Answer = "18"; Choices = '"16", "17", "18", "19"' },
    @{ Question = "4 × 5"; Answer = "20"; Choices = '"18", "19", "20", "21"' },
    @{ Question = "9 × 5"; Answer = "45"; Choices = '"43", "44", "45", "46"' },
    @{ Question = "4 × 10"; Answer = "40"; Choices = '"38", "39", "40", "41"' },
    @{ Question = "9 × 10"; Answer = "90"; Choices = '"88", "89", "90", "91"' }
)
$f = Fix-JsonFile -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

Write-Host ""
Write-Host "Total questions fixed: $totalFixes" -ForegroundColor Green
Write-Host "Files edited: $($filesEdited.Count)"