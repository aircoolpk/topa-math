import json, re

# Check g4 file for overall structure
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Look for mini_quiz type and its context
# Find the FIRST mini_quiz block
m = re.search(r'"type"\s*:\s*"mini_quiz"', content)
if m:
    start = m.start()
    # Get a chunk of 2000 chars
    chunk = content[start:start+2000]
    with open(r'D:\web app\4-craft.com\apps\api\first_mini_quiz.txt', 'w', encoding='utf-8') as out:
        out.write(f'First mini_quiz at char {start}\n\n')
        out.write(repr(chunk))
        out.write('\n\n\nPattern around data close:\n')
        # Find ] followed by }
        last_200 = chunk[-200:]
        out.write(repr(last_200))