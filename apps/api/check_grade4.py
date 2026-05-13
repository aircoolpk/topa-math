import json, re

# Check grade_4 mini_quiz for explanation_th
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Count explanation_th occurrences
count = content.count('explanation_th')
print('g4_angles_geometry.json has', count, 'explanation_th occurrences')

# Find mini_quiz blocks and check for explanation_th
for m in re.finditer(r'"type"\s*:\s*"mini_quiz"', content):
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
                    exp_count = block.count('explanation_th')
                    print(f'Mini_quiz block has {exp_count} explanation_th fields')
                    # Show structure - look for keys at mini_quiz level (not nested)
                    # Find the pattern "key": before the first { of mini_quiz
                    first_brace = block.index('{')
                    top_keys = re.findall(r'"([^"]+)"\s*:', block[:first_brace])
                    print(f'Top-level keys: {top_keys}')
                    break
        i += 1