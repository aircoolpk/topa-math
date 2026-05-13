$j = Get-Content "D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json" -Raw | ConvertFrom-Json
$variant = $j.lesson_variants[0]
foreach ($block in $variant.visual_blocks) {
    if ($block.type -eq "mini_quiz") {
        $block | ConvertTo-Json -Depth 20
    }
}