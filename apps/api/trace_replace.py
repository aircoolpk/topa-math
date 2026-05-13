import json, shutil

# Debug: trace the exact replacement being made

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Fix answer -> correct_answer
idx = content.find('"choices":')
arr_end = content.find(']', idx)
after = content[arr_end+1:arr_end+60]
if '"answer":' in after:
    content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
    print('Fixed answer->correct_answer')

# Find explanation_th placeholder
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Show exactly what's being replaced
print()
print('OLD section (bytes %d to %d):' % (old_start, old_end))
print(repr(content[old_start-20:old_start]) + '|' + repr(content[old_start:old_end]) + '|' + repr(content[old_end:old_end+20]))
print()
print('OLD section full:')
print(repr(content[old_start:old_end]))
print()

# The new section I'm inserting
new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n        '
print('NEW section:')
print(repr(new_section))
print()

# Apply
new_content = content[:old_start] + new_section + content[old_end:]

# Write
with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)
print('Written new content')

# Verify
try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print('VALID JSON!')
except json.JSONDecodeError as e:
    print('INVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno))
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    err = e.lineno - 1
    
    print()
    print('Error context:')
    for i in range(max(0, err-2), min(len(lines), err+3)):
        marker = '>>> ' if i == err else '    '
        print(marker + str(i+1) + ': ' + repr(lines[i]))