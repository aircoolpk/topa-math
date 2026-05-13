import json, shutil

# The problem: my new_section contains a } which creates TWO } on lines 252-253
# The original structure only has ONE } after explanation_th
# But I'm adding }, in my new_section which adds an extra }

# Let me think about this again:
# ORIGINAL broken structure:
#   ],
#           "explanation_th": "See..." spaces }
# The } closes the mini_quiz block

# After my fix, I want:
#   ],
#         },   <- close data
#         "explanation_th": "THAI",  <- explanation at mini_quiz level  
#         }   <- close mini_quiz (this is the ORIGINAL })

# But I'm NOT adding an extra } in my new_section... or am I?

# Let me trace byte by byte
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the problematic section
idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# Log positions
with open(r'D:\web app\4-craft.com\apps\api\positions.txt', 'w') as f:
    f.write('idx (explanation_th): %d\n' % idx)
    f.write('last_bracket: %d\n' % last_bracket)
    f.write('closingbrace: %d\n' % closingbrace)
    f.write('old_start: %d\n' % old_start)
    f.write('old_end: %d\n' % old_end)
    f.write('content[last_bracket]: %s\n' % repr(content[last_bracket]))
    f.write('content[closingbrace]: %s\n' % repr(content[closingbrace]))
    f.write('Old section: %s\n' % repr(content[old_start:old_end]))

# My new section
new_section = ',\n        },\n        "explanation_th": "' + THAI + '",\n      '

# Notice: I have a } in my new_section (after the comma)
# That } is meant to close the data object
# But the ORIGINAL } is also still there after old_end

# Let me check: what is content[old_end]?
with open(r'D:\web app\4-craft.com\apps\api\after_section.txt', 'w') as f:
    f.write('content[old_end]: %s\n' % repr(content[old_end]))
    f.write('content[old_end+1]: %s\n' % repr(content[old_end+1]))
    f.write('content[old_end+2]: %s\n' % repr(content[old_end+2]))
    f.write('content[old_end:old_end+20]: %s\n' % repr(content[old_end:old_end+20]))