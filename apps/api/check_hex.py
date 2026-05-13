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

new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n      '

with open(r'D:\web app\4-craft.com\apps\api\check_hex.txt', 'w', encoding='utf-8') as f:
    f.write('New section hex: ' + new_section.encode('utf-8').hex() + '\n')
    f.write('New section length: %d\n' % len(new_section))
    f.write('Contains }: %s\n' % ('}' in new_section))
    f.write('\n')
    f.write('Old section hex: ' + content[old_start:old_end].encode('utf-8').hex() + '\n')
    f.write('Old section contains }: %s\n' % ('}' in content[old_start:old_end]))
    
    # Apply fix
    new_content = content[:old_start] + new_section + content[old_end:]
    
    with open(fpath, 'w', encoding='utf-8-sig') as out:
        out.write(new_content)
    
    # Check result
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as out:
            json.load(out)
        f.write('\nVALID JSON!\n')
    except json.JSONDecodeError as e:
        f.write('\nINVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno) + '\n')
        
        with open(fpath, 'r', encoding='utf-8-sig') as out:
            lines = out.readlines()
        f.write('\nError context:\n')
        for i in range(max(0, e.lineno-4), min(len(lines), e.lineno+2)):
            f.write('  %d: %s\n' % (i+1, repr(lines[i])))