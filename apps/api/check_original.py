import json

# Check ORIGINAL (broken) file structure
path = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\original_lines.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total lines: {len(lines)}\n\n')
    for i in range(245, 260):
        if i < len(lines):
            out.write(f'Line {i+1}: {repr(lines[i])}\n')