# Check which files are valid JSON
$mathPath = "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\"
$results = @()

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer

$files = Get-ChildItem -Path $mathPath -Filter "*.json"

foreach ($file in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $j = $serializer.DeserializeObject($content)
        $results += [PSCustomObject]@{
            File = $file.Name
            Status = "OK"
            Variants = if ($j.lesson_variants) { $j.lesson_variants.Count } elseif ($j.mini_quiz) { "top-level" } else { "unknown" }
        }
    } catch {
        $results += [PSCustomObject]@{
            File = $file.Name
            Status = "PARSE_ERROR"
            Variants = $_.Exception.Message.Substring(0, 80)
        }
    }
}

$results | Format-Table -AutoSize
$results | Export-Csv -Path "D:\web app\4-craft.com\docs\parse_check.csv" -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "OK count: $(($results | Where-Object { $_.Status -eq 'OK' }).Count)"
Write-Host "Error count: $(($results | Where-Object { $_.Status -ne 'OK' }).Count)"