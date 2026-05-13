import json, shutil

# Debug: understand exactly what's happening with the structure

# Restore fresh
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Fix explanation_th
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Show what I'm replacing
old_section = content[old_start:old_end]
print('Old section:')
print(repr(old_section))
print()

# The old section includes:
# - whitespace after ] (the indentation of explanation_th)
# - "explanation_th": "See..."  (the explanation field at wrong position)
# - whitespace after the closing "
# - }  (closing brace for mini_quiz)

# After replacement:
# - original ] stays (closes questions)
# - my new_section adds: ,\n        },\n        "explanation_th": "THAI",
# - original closing } for mini_quiz stays

# So I should NOT include another } in my new_section!

# CORRECT new section (no extra }):
new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n      '
# Note: only 6 spaces at the end, not 8

print('New section (no trailing }):')
print(repr(new_section))
print()

new_content = content[:old_start] + new_section + content[old_end:]

with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

# Show result lines
with open(fpath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

with open(r'D:\web app\4-craft.com\apps\api\result_lines.txt', 'w', encoding='utf-8') as out:
    out.write('Result lines 247-258:\n')
    for i in range(246, 258):
        if i < len(lines):
            out.write(str(i+1) + ': ' + repr(lines[i]) + '\n')

# Verify
try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    with open(r'D:\web app\4-craft.com\apps\api\result_status.txt', 'w') as f:
        f.write('VALID JSON!')
except json.JSONDecodeError as e:
    with open(r'D:\web app\4-craft.com\apps\api\result_status.txt', 'w') as f:
        f.write('INVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno))