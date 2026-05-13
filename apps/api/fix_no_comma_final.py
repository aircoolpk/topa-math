import json, shutil

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# CORRECT new section - NO comma after explanation_th value
new_section = '\n        },\n        "explanation_th": "' + THAI + '"\n      '

new_content = content[:old_start] + new_section + content[old_end:]

with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    with open(r'D:\web app\4-craft.com\apps\api\result_status.txt', 'w') as f:
        f.write('VALID JSON!')
except json.JSONDecodeError as e:
    with open(r'D:\web app\4-craft.com\apps\api\result_status.txt', 'w') as f:
        f.write('INVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno))
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    err = e.lineno - 1
    
    with open(r'D:\web app\4-craft.com\apps\api\result_lines.txt', 'w', encoding='utf-8') as out:
        out.write('Error at line ' + str(e.lineno) + ', col ' + str(e.colno) + '\n\n')
        for i in range(max(0, err-3), min(len(lines), err+3)):
            marker = '>>> ' if i == err else '    '
            out.write(marker + str(i+1) + ': ' + repr(lines[i]) + '\n')