import json, shutil

log = []

# Restore fresh
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

log.append('Original length: ' + str(len(content)))

# Fix answer -> correct_answer
idx = content.find('"choices":')
if idx != -1:
    arr_end = content.find(']', idx)
    after = content[arr_end+1:arr_end+60]
    if '"answer":' in after:
        content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
        log.append('Fixed answer->correct_answer')

# Fix explanation_th
idx = content.find('"explanation_th": "See correct answer above"')
if idx != -1:
    before = content[:idx]
    last_bracket = before.rfind(']')
    closingbrace = content.find('}', idx)
    
    old_start = last_bracket + 1
    old_end = closingbrace + 1
    
    log.append('Old section from ' + str(old_start) + ' to ' + str(old_end))
    log.append('Old section: ' + repr(content[old_start:old_end]))
    
    new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n        '
    log.append('New section: ' + repr(new_section))
    
    new_content = content[:old_start] + new_section + content[old_end:]
    log.append('New length: ' + str(len(new_content)))
    
    with open(fpath, 'w', encoding='utf-8-sig') as f:
        f.write(new_content)
    
    # Now verify
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        new_file_content = f.read()
    
    log.append('Written file length: ' + str(len(new_file_content)))
    
    # Check if new_section is in the file
    if new_section in new_file_content:
        log.append('New section found in file!')
    else:
        log.append('WARNING: New section NOT found in file!')
    
    # Show the area around line 249
    lines = new_file_content.split('\n')
    log.append('')
    log.append('Lines 247-255 in new file:')
    for i in range(246, 256):
        if i < len(lines):
            log.append('  ' + str(i+1) + ': ' + repr(lines[i]))
    
    # Try to parse
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        log.append('VALID JSON!')
    except json.JSONDecodeError as e:
        log.append('INVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno))

with open(r'D:\web app\4-craft.com\apps\api\fix_log.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))