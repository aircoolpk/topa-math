import json, shutil

# Restore fresh
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

# Fix explanation_th
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n        '

new_content = content[:old_start] + new_section + content[old_end:]

with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

# Debug: show exact bytes around the error position
with open(fpath, 'rb') as f:
    raw = f.read()

bom_len = 3 if raw[:3] == b'\xef\xbb\xbf' else 0

# Find the position that corresponds to line 249, col 14
# First, find what char position line 249 col 14 is
with open(fpath, 'r', encoding='utf-8-sig') as f:
    text = f.read()

# The JSON error says char 6663 (0-indexed?) 
# Let's find what the actual error position is
try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print('VALID')
except json.JSONDecodeError as e:
    err_pos = e.pos
    print('Error at char (0-indexed):', err_pos)
    print('With BOM offset:', err_pos + bom_len)
    
    # Show bytes around the error position
    pos = err_pos + bom_len
    with open(r'D:\web app\4-craft.com\apps\api\error_pos.txt', 'w', encoding='utf-8') as out:
        out.write('Error char position: ' + str(err_pos) + '\n')
        out.write('Raw byte position (with BOM): ' + str(pos) + '\n\n')
        
        out.write('Bytes around error (pos ' + str(pos-20) + ' to ' + str(pos+50) + '):\n')
        out.write('Hex: ' + raw[pos-20:pos+50].hex() + '\n\n')
        
        # Also decode and show
        chunk = raw[pos-20:pos+50]
        try:
            decoded = chunk.decode('utf-8')
            out.write('Decoded: ' + repr(decoded) + '\n\n')
        except:
            out.write('Cannot decode\n\n')
        
        # Show the context in the file
        out.write('File content around position ' + str(err_pos) + ':\n')
        out.write(repr(text[max(0,err_pos-50):err_pos+100]))
        
        # Show lines
        lines = text.split('\n')
        out.write('\n\nLines around error:\n')
        for i in range(max(0, e.lineno-4), min(len(lines), e.lineno+2)):
            marker = '>>> ' if i == e.lineno-1 else '    '
            out.write(marker + str(i+1) + ': ' + repr(lines[i]) + '\n')