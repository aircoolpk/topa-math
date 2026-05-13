# Mini Quiz Schema Fix Script
# Fixes missing correct_answer and choices in mini_quiz blocks

$ErrorActionPreference = "Continue"
$basePath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"

function Get-JsonContent {
    param([string]$FilePath)
    return [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
}

function Save-JsonContent {
    param([string]$FilePath, [string]$Content)
    [System.IO.File]::WriteAllText($FilePath, $Content, [System.Text.Encoding]::UTF8)
}

function Fix-Question {
    param([string]$FilePath, [hashtable]$Fixes)
    
    $content = Get-JsonContent -FilePath $FilePath
    $original = $content
    $fixed = 0
    
    foreach ($fix in $Fixes) {
        $qText = $fix.Question
        $answer = $fix.Answer
        $choices = $fix.Choices
        
        # Find question position
        $qIndex = $content.IndexOf($qText)
        if ($qIndex -lt 0) {
            Write-Host "  NOT FOUND: $qText"
            continue
        }
        
        # Find end of question block (closing brace)
        $afterQ = $content.Substring($qIndex + $qText.Length)
        $braceCount = 0
        $started = $false
        $endPos = 0
        for ($i = 0; $i -lt $afterQ.Length; $i++) {
            if ($afterQ[$i] -eq '{') { $braceCount++; $started = $true }
            if ($afterQ[$i] -eq '}') { 
                $braceCount-- 
                if ($started -and $braceCount -eq 0) { $endPos = $i; break }
            }
        }
        
        $blockStart = $qIndex
        $blockEnd = $qIndex + $qText.Length + $endPos + 1
        $questionBlock = $content.Substring($blockStart, $blockEnd - $blockStart)
        
        # Skip if already fixed
        if ($questionBlock -match '"correct_answer"') {
            Write-Host "  Already fixed: $qText"
            continue
        }
        
        # Insert before closing brace
        $insertPos = $blockEnd - 1
        $insertText = "`n                `"choices`": [$choices],`n                `"answer`": `"$answer`",`n                `"correct_answer`": `"$answer`""
        
        $content = $content.Substring(0, $insertPos) + $insertText + $content.Substring($insertPos)
        $fixed++
        Write-Host "  Fixed: $qText -> $answer"
    }
    
    if ($fixed -gt 0) {
        Save-JsonContent -FilePath $FilePath -Content $content
        Write-Host "  Saved ($fixed fixes)"
    }
    
    return $fixed
}

# Track total fixes
$totalFixes = 0
$filesEdited = @()

# === g2_money_change.json ===
# Question: ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?
# Answer: 100 - 44 = 56
Write-Host "=== Fixing g2_money_change.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_money_change.json"
$fixes = @(
    @{ Question = "ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?"; Answer = "56"; Choices = '"54", "55", "56", "57"' }
)
$f = Fix-Question -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# === g2_multiplication_intro.json ===
# 5 x 6 = 30, 2 x 7 = 14
Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
$fixes = @(
    @{ Question = "5 × 6 = ?"; Answer = "30"; Choices = '"28", "29", "30", "31"' },
    @{ Question = "2 × 7 = ?"; Answer = "14"; Choices = '"12", "13", "14", "15"' }
)
$f = Fix-Question -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

# === g2_times_table_2_5_10.json ===
# 4x2=8, 4x5=20, 4x10=40, 9x2=18, 9x5=45, 9x10=90
Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
$fixes = @(
    @{ Question = "4 × 2 = ?"; Answer = "8"; Choices = '"6", "7", "8", "9"' },
    @{ Question = "9 × 2 = ?"; Answer = "18"; Choices = '"16", "17", "18", "19"' },
    @{ Question = "4 × 5 = ?"; Answer = "20"; Choices = '"18", "19", "20", "21"' },
    @{ Question = "9 × 5 = ?"; Answer = "45"; Choices = '"43", "44", "45", "46"' },
    @{ Question = "4 × 10 = ?"; Answer = "40"; Choices = '"38", "39", "40", "41"' },
    @{ Question = "9 × 10 = ?"; Answer = "90"; Choices = '"88", "89", "90", "91"' }
)
$f = Fix-Question -FilePath $fp -Fixes $fixes
if ($f -gt 0) { $totalFixes += $f; $filesEdited += $fp }

Write-Host ""
Write-Host "Total questions fixed: $totalFixes" -ForegroundColor Green
Write-Host "Files edited: $($filesEdited.Count)"