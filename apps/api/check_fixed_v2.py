import json

# Check the exact current state of the fixed file
fpath = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(fpath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\fixed_current.txt', 'w', encoding='utf-8') as out:
    out.write('Current state of fixed file:\n')
    for i in range(245, 260):
        if i < len(lines):
            line = lines[i]
            spaces = len(line) - len(line.lstrip())
            out.write(f'Line {i+1} (indent={spaces}, len={len(line)}): {repr(line)}\n')
    
    # Also try to understand where char 6663 is in the file
    # Sum all previous line lengths
    total = 0
    for i in range(250):
        total += len(lines[i])
    out.write(f'\nChar position 6663 corresponds to:\n')
    out.write(f'Sum of lines 1-250 = {total} chars\n')
    out.write(f'Char 6663 is at offset {6663 - total} in line 251\n')
    
    # Show raw bytes around position 6663
    with open(fpath, 'rb') as f:
        raw = f.read()
    pos = 6663 + 3  # BOM offset
    out.write(f'\nRaw bytes around pos {pos}:\n')
    out.write(f'Hex: {raw[pos-20:pos+40].hex()}\n')
    out.write(f'String: {repr(raw[pos-20:pos+40].decode("utf-8", errors="replace"))}\n')