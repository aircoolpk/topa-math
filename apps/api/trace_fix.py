import json, shutil

# Let me trace EXACTLY what's happening by doing the fix and immediately checking the output

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

# Read original
with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find positions
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Log the positions
with open(r'D:\web app\4-craft.com\apps\api\fix_trace.txt', 'w', encoding='utf-8') as log:
    log.write('idx = %d\n' % idx)
    log.write('last_bracket = %d\n' % last_bracket)
    log.write('closingbrace = %d\n' % closingbrace)
    log.write('old_start = %d\n' % old_start)
    log.write('old_end = %d\n' % old_end)
    log.write('\n')
    
    log.write('Before old_start (20 chars): %s\n' % repr(content[old_start-20:old_start]))
    log.write('OLD section: %s\n' % repr(content[old_start:old_end]))
    log.write('\n')
    
    # Build new section
    new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n      '
    log.write('NEW section: %s\n' % repr(new_section))
    log.write('\n')
    
    # Apply
    new_content = content[:old_start] + new_section + content[old_end:]
    
    # Show what comes after old_end
    log.write('After old_end (30 chars): %s\n' % repr(content[old_end:old_end+30]))
    log.write('\n')
    
    # Show the transition point
    log.write('Transition (chars around old_start-5 to old_start+len(new_section)+5):\n')
    transition_start = max(0, old_start - 5)
    transition_end = old_start + len(new_section) + 5
    log.write('%s\n' % repr(new_content[transition_start:transition_end]))
    log.write('\n')
    
    # Write the new content
    with open(fpath, 'w', encoding='utf-8-sig') as f:
        f.write(new_content)
    
    log.write('Written new content, length: %d -> %d\n' % (len(content), len(new_content)))
    
    # Validate
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        log.write('\nVALID JSON!\n')
    except json.JSONDecodeError as e:
        log.write('\nINVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno) + '\n')
        log.write('Error position (char): %d\n' % e.pos)
        
        # Show lines around error
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        err = e.lineno - 1
        
        log.write('\nLines %d-%d:\n' % (err-1, err+3))
        for i in range(max(0, err-1), min(len(lines), err+4)):
            marker = '>>> ' if i == err else '    '
            log.write(marker + str(i+1) + ': ' + repr(lines[i]) + '\n')

print('Trace written to fix_trace.txt')