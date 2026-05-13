import json, re

# Find and print the structure of a VALID mini_quiz from grade_4
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find first mini_quiz block
m = re.search(r'"type"\s*:\s*"mini_quiz"', content)
if m:
    start = m.start()
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
                    # Show last 500 chars to see the closing structure
                    with open(r'D:\web app\4-craft.com\apps\api\valid_block.txt', 'w', encoding='utf-8') as out:
                        out.write('Last 500 chars of mini_quiz block:\n')
                        out.write(repr(block[-500:]))
                        out.write('\n\n')
                        out.write('Explanation_th position:\n')
                        exp_pos = block.rfind('"explanation_th"')
                        if exp_pos >= 0:
                            out.write(f'explanation_th at position {exp_pos}\n')
                            out.write(f'Block length: {len(block)}\n')
                            out.write(f'Context: {repr(block[exp_pos:exp_pos+100])}\n')
                    break
        i += 1