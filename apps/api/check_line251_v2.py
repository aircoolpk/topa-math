import json

path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\line251.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total lines: {len(lines)}\n\n')
    for i in range(245, 255):
        if i < len(lines):
            out.write(f'Line {i+1}: {repr(lines[i])}\n')
    
    # Also show around col 70 in line 251
    if len(lines) > 250:
        line = lines[250]
        out.write(f'\nLine 251 length: {len(line)}\n')
        out.write(f'Col 70 area: {repr(line[60:90])}\n')