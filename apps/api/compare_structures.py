import json

# Read g4 file which is VALID and understand the EXACT structure
g4_path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(g4_path, 'r', encoding='utf-8-sig') as f:
    g4_content = f.read()

# Find first mini_quiz block and show its EXACT closing structure
import re
m = re.search(r'"type"\s*:\s*"mini_quiz"', g4_content)
if m:
    start = m.start()
    # Find block end by counting braces
    depth = 0
    i = start
    while i < len(g4_content):
        if g4_content[i] == '{':
            depth += 1
        elif g4_content[i] == '}':
            depth -= 1
            if depth == 0:
                block = g4_content[start:i+1]
                # Show the last 300 chars with escapes
                last_part = block[-300:]
                with open(r'D:\web app\4-craft.com\apps\api\g4_valid_structure.txt', 'w', encoding='utf-8') as out:
                    out.write('VALID mini_quiz last 300 chars:\n')
                    out.write(repr(last_part))
                print('Written g4_valid_structure.txt')
                break
        i += 1

# Now analyze the BROKEN g2 file
g2_path = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(g2_path, 'r', encoding='utf-8-sig') as f:
    g2_content = f.read()

# Find first mini_quiz in g2
m2 = re.search(r'"type"\s*:\s*"mini_quiz"', g2_content)
if m2:
    start = m2.start()
    depth = 0
    i = start
    while i < len(g2_content):
        if g2_content[i] == '{':
            depth += 1
        elif g2_content[i] == '}':
            depth -= 1
            if depth == 0:
                block = g2_content[start:i+1]
                with open(r'D:\web app\4-craft.com\apps\api\g2_broken_structure.txt', 'w', encoding='utf-8') as out:
                    out.write('BROKEN mini_quiz last 500 chars:\n')
                    out.write(repr(block[-500:]))
                    out.write('\n\nFirst 200 chars:\n')
                    out.write(repr(block[:200]))
                print('Written g2_broken_structure.txt')
                break
        i += 1