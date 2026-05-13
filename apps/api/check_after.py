import json, shutil

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the exact positions
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Show content AFTER old_end
with open(r'D:\web app\4-craft.com\apps\api\after_old_end.txt', 'w', encoding='utf-8') as f:
    f.write('Content from old_end onwards:\n')
    f.write('old_end = %d\n' % old_end)
    f.write('Content[old_end:old_end+30] = %s\n' % repr(content[old_end:old_end+30]))
    f.write('Content[old_end:old_end+30] hex = %s\n' % content[old_end:old_end+30].encode('utf-8').hex())
    f.write('\n')
    
    # Calculate line numbers
    # The original line 249 is the line with ]
    # Let's find where lines start
    lines_content = content[:last_bracket].split('\n')
    f.write('Number of lines before last_bracket: %d\n' % len(lines_content))
    f.write('Line with last_bracket would be line %d\n' % (len(lines_content) + 1))
    
    # The error says line 249 col 14
    # Let's verify what character 6582 (the error position) corresponds to
    f.write('\nCharacter at position 6582:\n')
    f.write('content[6582] = %s\n' % repr(content[6582]))
    f.write('content[6581] = %s\n' % repr(content[6581]))
    f.write('content[6580] = %s\n' % repr(content[6580]))