import json

with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\line251_debug.txt', 'w', encoding='utf-8') as out:
    out.write('Line 251:\n')
    out.write(repr(lines[250]) + '\n\n')
    out.write('Line 252:\n')
    out.write(repr(lines[251]) + '\n\n')
    out.write('Line 253:\n')
    out.write(repr(lines[252]) + '\n\n')
    
    # Check context around char 6652
    with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    out.write('Chars 6640-6720:\n')
    out.write(repr(content[6640:6720]) + '\n\n')
    
    # Find the problematic closing brace
    # The pattern is: "explanation_th": "See correct answer above" with garbage before }
    import re
    pattern = r'"explanation_th"\s*:\s*"See correct answer above"'
    for m in re.finditer(pattern, content):
        out.write(f'Match at {m.start()}: {repr(content[m.start():m.end()+50])}\n')