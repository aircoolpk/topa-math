import json, shutil

# Restore all files
files = [
    'g2_add_two_digit.json',
    'g2_money_change.json',
    'g2_multiplication_intro.json',
    'g2_shapes_2d.json',
    'g2_subtract_two_digit.json',
    'g2_times_table_2_5_10.json',
    'g2_time_calendar.json',
]

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'

for fname in files:
    src = backup_dir + '\\' + fname
    dst = lessons_dir + '\\' + fname
    shutil.copy2(src, dst)
    print(f'Restored {fname}')

print()

# Test the fix on g2_add_two_digit.json only
fpath = lessons_dir + '\\g2_add_two_digit.json'
THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Step 1: Fix answer -> correct_answer
idx = content.find('"choices":')
arr_end = content.find(']', idx)
after = content[arr_end+1:arr_end+60]
if '"answer":' in after:
    content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
    print('Fixed answer->correct_answer')

# Step 2: Fix explanation_th
idx = content.find('"explanation_th": "See correct answer above"')
print(f'Found placeholder at index {idx}')

before = content[:idx]
last_bracket = before.rfind(']')
print(f'Last bracket at index {last_bracket}')

closingbrace = content.find('}', idx)
print(f'Closing brace at index {closingbrace}')

old_start = last_bracket + 1
old_end = closingbrace + 1
old_section = content[old_start:old_end]
print(f'Old section len={len(old_section)}')

new_section = '\n        },\n        "explanation_th": "' + THAI + '",\n      '
print(f'New section len={len(new_section)}')

new_content = content[:old_start] + new_section + content[old_end:]
print(f'Content: {len(content)} -> {len(new_content)}')

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
    with open(r'D:\web app\4-craft.com\apps\api\test_error.txt', 'w', encoding='utf-8') as out:
        for i in range(max(0, err-2), min(len(lines), err+3)):
            marker = '>>> ' if i == err else '    '
            out.write(f'{marker}{i+1}: {repr(lines[i])}\n')