import json, re

# Check g4 file - what is the overall structure of mini_quiz
# Is mini_quiz INSIDE another block or is it at variant level?
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find mini_quiz parent structure
# Find the variant that contains mini_quiz
m = re.search(r'"variant_id"\s*:\s*"v01"', content)
if m:
    start = m.start()
    # Find where this variant ends
    depth = 0
    in_string = False
    i = start
    while i < len(content):
        c = content[i]
        if c == '"' and (i == 0 or content[i-1] != '\\'):
            in_string = not in_string
        elif not in_string:
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    block = content[start:end]
                    with open(r'D:\web app\4-craft.com\apps\api\variant_structure.txt', 'w', encoding='utf-8') as out:
                        out.write(f'Variant v01 block from char {start} to {end}\n')
                        out.write(f'Block length: {len(block)}\n\n')
                        out.write('First 2000 chars:\n')
                        out.write(repr(block[:2000]))
                        out.write('\n\nLast 1000 chars:\n')
                        out.write(repr(block[-1000:]))
                    break
        i += 1