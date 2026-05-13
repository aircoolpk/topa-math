import json

# Trace what the fix produced for line 251
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\fixed_lines.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total lines: {len(lines)}\n\n')
    for i in range(245, 260):
        if i < len(lines):
            out.write(f'Line {i+1}: {repr(lines[i])}\n')