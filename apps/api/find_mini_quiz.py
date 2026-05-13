import json, re

# Check g4 file more carefully for mini_quiz
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find all "type": "mini_quiz" with context
for m in re.finditer(r'"type"\s*:\s*"mini_quiz"', content):
    start = max(0, m.start() - 50)
    end = min(len(content), m.end() + 100)
    with open(r'D:\web app\4-craft.com\apps\api\mini_quiz_locations.txt', 'a', encoding='utf-8') as out:
        out.write(f'At char {m.start()}:\n')
        out.write(repr(content[start:end]) + '\n\n')

# Also check if mini_quiz has content.explanation_th or explanation_th at top level
# Find one mini_quiz block and parse it as JSON manually
m = re.search(r'"type"\s*:\s*"mini_quiz"', content)
if m:
    start = m.start()
    # Find the full block by counting braces
    depth = 0
    in_string = False
    i = start
    block_start = None
    while i < len(content):
        c = content[i]
        if c == '"' and (i == 0 or content[i-1] != '\\'):
            in_string = not in_string
        elif not in_string:
            if c == '{':
                if depth == 0:
                    block_start = i
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0 and block_start is not None:
                    block_end = i + 1
                    block = content[block_start:block_end]
                    try:
                        block_json = json.loads(block)
                        with open(r'D:\web app\4-craft.com\apps\api\mini_quiz_parse.txt', 'w', encoding='utf-8') as out:
                            out.write('Parsed mini_quiz block:\n')
                            json.dump(block_json, out, indent=2, ensure_ascii=False)
                        print('Successfully parsed mini_quiz block')
                        print('Keys:', list(block_json.keys()))
                    except Exception as e:
                        print(f'Failed to parse: {e}')
                    break
        i += 1