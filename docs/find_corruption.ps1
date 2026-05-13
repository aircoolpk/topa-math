# Node.js JSON validator - find exact corruption
$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Try to find the issue - look for malformed patterns
# Common issue: "choices": [...] without closing brace before it

# Find all occurrences of "choices": [ and check what follows
$idx = 0
$problemLocations = @()

while (($idx = $content.IndexOf('"choices"', $idx)) -gt 0) {
    $start = $idx
    $next = $idx + 20
    
    # Find the end of this line
    $lineEnd = $content.IndexOf("`n", $next)
    if ($lineEnd -gt $idx + 200) { $lineEnd = $idx + 200 }
    
    $section = $content.Substring($idx, [Math]::Min(300, $lineEnd - $idx))
    
    # Check if this looks malformed - missing closing brace before choices
    if ($section -notmatch '}\s*,\s*"choices"') {
        # Check if there's a missing comma or brace issue
        $beforeSection = $content.Substring([Math]::Max(0, $idx - 100), 100)
        if ($beforeSection -match 'text_th.*"choices"' -and $beforeSection -notmatch '\}\s*"choices"') {
            $problemLocations += $idx
            Write-Host "Found potential issue at position $idx"
            Write-Host "Context: ...$($content.Substring([Math]::Max(0, $idx-50), 100))..."
            Write-Host ""
        }
    }
    
    $idx++
}

Write-Host "Total problem locations: $($problemLocations.Count)"

# Alternative: find the specific pattern where the corruption occurs
# Looking for: ..."text_th": "67 + 21 = ?"...} "choices"
# The correct pattern should be: ..."text_th": "...", "choices":
# If there are extra characters between } and "choices", that's the problem

# Find "67 + 21" position
$qPos = $content.IndexOf("67 + 21")
if ($qPos -gt 0) {
    Write-Host "Question found at position $qPos"
    $section = $content.Substring($qPos, 500)
    Write-Host "Section starting at question:"
    Write-Host $section.Substring(0, 300)
}