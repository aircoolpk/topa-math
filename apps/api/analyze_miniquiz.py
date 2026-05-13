import json, re

path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the mini_quiz block to understand structure
# Look for the "data": { ... "questions": [ ... ] ... "explanation_th" pattern
# The issue: "explanation_th" appears INSIDE the "data" object after "questions" array closes

# Find all mini_quiz blocks
mini_quiz_pattern = r'"type"\s*:\s*"mini_quiz"'
for m in re.finditer(mini_quiz_pattern, content):
    start = m.start()
    # Find the matching closing for this mini_quiz block (at depth 1)
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
                    # Check if explanation_th is inside data (wrong) vs at mini_quiz level (correct)
                    data_match = re.search(r'"data"\s*:\s*\{', block)
                    if data_match:
                        data_start = data_match.end()
                        # Check if explanation_th appears before the closing } of data
                        # We need to see if explanation_th is inside or outside the data object
                        # Find the position of explanation_th relative to data object
                        exp_match = re.search(r'"explanation_th"', block)
                        if exp_match:
                            # Find where data object closes (the } before explanation_th might be wrong)
                            # Let's look at the structure
                            with open(r'D:\web app\4-craft.com\apps\api\debug_miniquiz.txt', 'w', encoding='utf-8') as out:
                                out.write(f'Mini_quiz block at char {start}:\n')
                                out.write(f'Data object starts at: {data_start}\n')
                                out.write(f'Explanation_th at: {exp_match.start()}\n')
                                # Show the transition area
                                trans_start = data_start + 200  # After "data": {
                                trans_end = exp_match.start() + 50
                                out.write(f'\nTransition area (chars {trans_start}-{trans_end}):\n')
                                out.write(repr(block[trans_start:trans_end]))
                    break
        i += 1
    break  # Just analyze first mini_quiz block

print('Done - check debug_miniquiz.txt')