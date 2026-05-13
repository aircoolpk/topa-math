# Validate JSON using .NET directly
Add-Type -AssemblyName System.Web.Extensions

$file = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_multiplication_intro.json"
$jsonText = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
try {
    $obj = $serializer.DeserializeObject($jsonText)
    Write-Host "JSON valid via JavaScriptSerializer"
} catch {
    Write-Host "JavaScriptSerializer failed: $_"
}

# Alternative: try regex to check basic JSON structure
if ($jsonText -match '^\s*\{' -and $jsonText -match '\}\s*$') {
    Write-Host "Basic JSON structure appears valid"
} else {
    Write-Host "Basic JSON structure check failed"
}

# Check for the problematic pattern (null values being serialized incorrectly)
if ($jsonText -match ',null[\s,\}]') {
    Write-Host "WARNING: Found null values in JSON"
}

# Find where the issue might be - look for patterns like "...choices":."
$idx = $jsonText.IndexOf('choices')
if ($idx -gt 0) {
    $section = $jsonText.Substring($idx, [Math]::Min(500, $jsonText.Length - $idx))
    Write-Host "First choices occurrence:"
    Write-Host $section.Substring(0, [Math]::Min(200, $section.Length))
}