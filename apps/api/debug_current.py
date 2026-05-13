import json

# Check the current state of the fixed file around line 251
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\debug_lines.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total lines: {len(lines)}\n\n')
    for i in range(245, 260):
        if i < len(lines):
            line = lines[i]
            out.write(f'Line {i+1} (len={len(line)}): {repr(line)}\n')
    
    # Find the mini_quiz block boundaries
    # Lines 246-255 seem to be inside a mini_quiz block
    # Line 249: ] closes questions
    # Line 250: } closes data (my insertion)
    # Line 251: "explanation_th": "THAI", closes explanation
    # Line 252: spaces
    # Line 253: } closes mini_quiz
    # Line 254: ] closes something
    # Line 255: } closes something else
    
    # So after my fix, the structure is:
    # content: { questions: [...] }, <- line 249 closes array, line 250 closes data
    # explanation_th: "..."         <- line 251
    # }                             <- line 253 closes mini_quiz
    # ]                             <- line 254 closes ??? (should be visual_blocks?)
    # },                            <- line 255 closes variant

with open(r'D:\web app\4-craft.com\apps\api\debug_lines.txt', 'r', encoding='utf-8') as f:
    print(f.read())