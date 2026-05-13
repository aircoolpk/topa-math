import json, re

# Analyze the BROKEN mini_quiz structure in grade_2
path = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the mini_quiz block and parse its structure
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
                    with open(r'D:\web app\4-craft.com\apps\api\broken_block.txt', 'w', encoding='utf-8') as out:
                        out.write(f'Block length: {len(block)}\n\n')
                        
                        # Find "data" object
                        data_match = re.search(r'"data"\s*:\s*\{', block)
                        if data_match:
                            out.write(f'"data" object starts at offset {data_match.start()}\n')
                            data_content_start = data_match.end()
                            # Find where data object ends
                            # It should end before "explanation_th"
                            exp_match = re.search(r'"explanation_th"', block)
                            if exp_match:
                                out.write(f'"explanation_th" at offset {exp_match.start()}\n')
                                # So data object should end at exp_match.start() - but there's no } there
                                # Show the transition from data to explanation_th
                                out.write(f'\nTransition area (data end - explanation_th):\n')
                                out.write(repr(block[data_content_start:exp_match.start()+50]))
                        
                        out.write(f'\n\nLast 800 chars of block:\n')
                        out.write(repr(block[-800:]))
                    break
        i += 1