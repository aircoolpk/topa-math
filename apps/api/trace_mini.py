import json

# Trace the mini_quiz block structure to understand indentation hierarchy
# Start from line 240 (inside the mini_quiz) and go forward to see when it starts
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# Find the start of the mini_quiz block by looking for "type": "mini_quiz"
mini_start = None
for i, line in enumerate(lines):
    if '"type": "mini_quiz"' in line:
        mini_start = i
        break

if mini_start:
    with open(r'D:\web app\4-craft.com\apps\api\mini_trace.txt', 'w', encoding='utf-8') as out:
        out.write(f'Mini_quiz starts at line {mini_start+1}\n\n')
        # Show lines from mini_quiz start to line 260
        for i in range(mini_start, min(len(lines), mini_start + 30)):
            line = lines[i]
            spaces = len(line) - len(line.lstrip())
            out.write(f'Line {i+1} (indent={spaces}): {repr(line[:80])}\n')
else:
    with open(r'D:\web app\4-craft.com\apps\api\mini_trace.txt', 'w', encoding='utf-8') as out:
        out.write('Could not find mini_quiz start\n')