import json, shutil

# Restore
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'

files = ['g2_add_two_digit.json']

for fname in files:
    src = backup_dir + '\\' + fname
    dst = lessons_dir + '\\' + fname
    shutil.copy2(src, dst)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

fpath = lessons_dir + '\\' + files[0]
with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Fix answer -> correct_answer
idx = content.find('"choices":')
arr_end = content.find(']', idx)
after = content[arr_end+1:arr_end+60]
if '"answer":' in after:
    content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)

# Find explanation_th placeholder
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Correct new section
new_section = '],\n        },\n        "explanation_th": "' + THAI + '",\n        }\n'

new_content = content[:old_start] + new_section + content[old_end:]

with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print('VALID JSON!')
except json.JSONDecodeError as e:
    print(f'INVALID: {e.msg} at line {e.lineno}, col {e.colno}')
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    err = e.lineno - 1
    
    with open(r'D:\web app\4-craft.com\apps\api\final_error.txt', 'w', encoding='utf-8') as out:
        out.write(f'Error at line {e.lineno}, col {e.colno}\n\n')
        for i in range(max(0, err-3), min(len(lines), err+3)):
            marker = '>>> ' if i == err else '    '
            out.write(f'{marker}{i+1}: {repr(lines[i])}\n')