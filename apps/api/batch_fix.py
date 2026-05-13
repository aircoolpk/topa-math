import json, shutil

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

files = [
    'g2_add_two_digit.json',
    'g2_money_change.json',
    'g2_multiplication_intro.json',
    'g2_shapes_2d.json',
    'g2_subtract_two_digit.json',
    'g2_times_table_2_5_10.json',
    'g2_time_calendar.json',
]

for fname in files:
    fpath = lessons_dir + '\\' + fname
    shutil.copy2(backup_dir + '\\' + fname, fpath)
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # Fix 1: "answer" -> "correct_answer"
    for _ in range(20):
        idx = content.find('"choices":')
        if idx == -1:
            break
        arr_end = content.find(']', idx)
        if arr_end == -1:
            break
        after = content[arr_end+1:arr_end+60]
        if '"answer":' in after:
            content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
    
    # Fix 2: explanation_th placeholder - loop through ALL occurrences
    for _ in range(20):
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        before = content[:idx]
        last_bracket = before.rfind(']')
        closingbrace = content.find('}', idx)
        
        if last_bracket < 0 or closingbrace < 0:
            break
        
        old_start = last_bracket + 1
        old_end = closingbrace + 1
        
        new_section = '\n        },\n        "explanation_th": "' + THAI + '"\n      '
        
        content = content[:old_start] + new_section + content[old_end:]
    
    with open(fpath, 'w', encoding='utf-8-sig') as f:
        f.write(content)
    
    # Validate
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        with open(r'D:\web app\4-craft.com\apps\api\batch_status.txt', 'a') as f:
            f.write(fname + ': VALID\n')
    except json.JSONDecodeError as e:
        with open(r'D:\web app\4-craft.com\apps\api\batch_status.txt', 'a') as f:
            f.write(fname + ': INVALID - ' + e.msg + ' at line ' + str(e.lineno) + '\n')

print('Done!')