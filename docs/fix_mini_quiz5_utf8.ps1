# Mini Quiz Schema Fix Script v5
# Uses explicit encoding to handle Thai characters safely

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
    param([string]$FilePath, [string]$Question, [string]$Answer, [string]$Choices)
    
    $content = Get-JsonContent -FilePath $FilePath
    $original = $content
    
    # Find question position - search for "text_th": "QUESTION"
    $searchPattern = "`"text_th`": `"$Question`""
    $qIndex = $content.IndexOf($searchPattern)
    
    if ($qIndex -lt 0) {
        # Try without quotes around question (some files store without escape)
        $altPattern = " `"text_th`": `"*$Question`""
        $qIndex = $content.IndexOf($Question)
        if ($qIndex -lt 0) {
            Write-Host "  NOT FOUND: $Question"
            return $false
        }
        # Find start of the text_th field
        $textThPos = $content.LastIndexOf("`"text_th`"", $qIndex)
        if ($textThPos -ge 0) {
            $qIndex = $textThPos
            $searchPattern = $content.Substring($textThPos, $qIndex - $textThPos + $qIndex - $textThPos)
        }
    }
    
    # Find the end of this question object (closing brace)
    # Start from end of question text search
    $searchEnd = $qIndex + 10000  # reasonable bound
    if ($searchEnd -gt $content.Length) { $searchEnd = $content.Length }
    
    $afterQ = $content.Substring($qIndex, $searchEnd - $qIndex)
    
    # Find the closing brace that ends this question object
    # Look for pattern: , "text_th" or , "answer" or ]} which would be end of questions array
    # We need to find the } that closes this specific question
    
    $braceCount = 0
    $inString = $false
    $escaped = $false
    $questionEnd = -1
    
    for ($i = 0; $i -lt $afterQ.Length; $i++) {
        $ch = $afterQ[$i]
        
        if ($escaped) {
            $escaped = $false
            continue
        }
        
        if ($ch -eq '"' -and $i -gt 0 -and $afterQ[$i-1] -ne '\') {
            $inString = -not $inString
            continue
        }
        
        if ($inString) { continue }
        
        if ($ch -eq '{') { $braceCount++ }
        if ($ch -eq '}') {
            $braceCount--
            if ($braceCount -eq 0) {
                $questionEnd = $i
                break
            }
        }
    }
    
    if ($questionEnd -lt 0) {
        Write-Host "  Cannot find question end: $Question"
        return $false
    }
    
    # Get the full question block
    $blockStart = $qIndex
    $blockEnd = $qIndex + $questionEnd + 1
    $questionBlock = $content.Substring($blockStart, $blockEnd - $blockStart)
    
    # Check if already fixed
    if ($questionBlock -match '"correct_answer"') {
        Write-Host "  Already fixed: $Question"
        return $false
    }
    
    # Find where to insert - before the closing }
    $insertPos = $blockEnd - 1
    $insertText = ",`n                `"choices`": [$Choices],`n                `"answer`": `"$Answer`",`n                `"correct_answer`": `"$Answer`""
    
    $content = $content.Substring(0, $insertPos) + $insertText + $content.Substring($insertPos)
    Save-JsonContent -FilePath $FilePath -Content $content
    Write-Host "  Fixed: $Question -> $Answer"
    return $true
}

# Total fixes
$totalFixes = 0
$filesEdited = @()

# === g2_money_change.json ===
Write-Host "=== Fixing g2_money_change.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_money_change.json"
# 100 - 44 = 56
$result = Fix-Question -FilePath $fp -Question "ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?" -Answer "56" -Choices '"54", "55", "56", "57"'
if ($result) { $totalFixes++; $filesEdited += $fp }

# === g2_multiplication_intro.json ===
Write-Host "=== Fixing g2_multiplication_intro.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_multiplication_intro.json"
$result1 = Fix-Question -FilePath $fp -Question "5 × 6 = ?" -Answer "30" -Choices '"28", "29", "30", "31"'
$result2 = Fix-Question -FilePath $fp -Question "2 × 7 = ?" -Answer "14" -Choices '"12", "13", "14", "15"'
if ($result1 -or $result2) { $totalFixes += 2; $filesEdited += $fp }

# === g2_times_table_2_5_10.json ===
Write-Host "=== Fixing g2_times_table_2_5_10.json ===" -ForegroundColor Cyan
$fp = $basePath + "g2_times_table_2_5_10.json"
$r1 = Fix-Question -FilePath $fp -Question "4 × 2 = ?" -Answer "8" -Choices '"6", "7", "8", "9"'
$r2 = Fix-Question -FilePath $fp -Question "9 × 2 = ?" -Answer "18" -Choices '"16", "17", "18", "19"'
$r3 = Fix-Question -FilePath $fp -Question "4 × 5 = ?" -Answer "20" -Choices '"18", "19", "20", "21"'
$r4 = Fix-Question -FilePath $fp -Question "9 × 5 = ?" -Answer "45" -Choices '"43", "44", "45", "46"'
$r5 = Fix-Question -FilePath $fp -Question "4 × 10 = ?" -Answer "40" -Choices '"38", "39", "40", "41"'
$r6 = Fix-Question -FilePath $fp -Question "9 × 10 = ?" -Answer "90" -Choices '"88", "89", "90", "91"'
if ($r1 -or $r2 -or $r3 -or $r4 -or $r5 -or $r6) {
    $cnt = 0
    if ($r1) { $cnt++ }
    if ($r2) { $cnt++ }
    if ($r3) { $cnt++ }
    if ($r4) { $cnt++ }
    if ($r5) { $cnt++ }
    if ($r6) { $cnt++ }
    $totalFixes += $cnt
    $filesEdited += $fp
}

Write-Host ""
Write-Host "Total questions fixed: $totalFixes" -ForegroundColor Green
Write-Host "Files edited: $($filesEdited.Count)"
