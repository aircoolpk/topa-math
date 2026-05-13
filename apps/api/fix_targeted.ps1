# Targeted fix script - fixes Schema B mini_quiz blocks only
param([string[]]$Files)

# Load Thai explanation from external UTF-8 file
$expFile = "D:\web app\4-craft.com\apps\api\thai_exp.txt"
$thaiExp = Get-Content $expFile -Encoding UTF8 -Raw
$thaiExp = $thaiExp.Trim()

foreach ($f in $Files) {
    $path = $f
    if (-not (Test-Path $path)) { Write-Host "SKIP: $path"; continue }
    
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $original = $content
    $filename = Split-Path $path -Leaf
    
    Write-Host "Processing $filename..."
    
    # Fix 1: Rename "answer" -> "correct_answer" in mini_quiz questions with choices
    # Pattern: text_th + choices + answer -> text_th + choices + correct_answer
    $content = $content -replace 
        '("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"(\s*:\s*)"([^"]+)"',
        '$1"correct_answer"$2"$3"'
    
    # Fix 2: Replace "explanation_th":"See correct answer above" with proper Thai
    $placeholder = '"explanation_th":"See correct answer above"'
    $replacement = '"explanation_th":"' + $thaiExp + '"'
    $content = $content -replace [regex]::Escape($placeholder), $replacement
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  Fixed: $filename"
    } else {
        Write-Host "  No changes: $filename"
    }
}
