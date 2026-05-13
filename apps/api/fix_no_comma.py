import json, shutil

# The problem: I'm adding a comma after ] which closes questions array
# But in JSON, you can't have a trailing comma after the last element

# The ORIGINAL structure has:
# "data": {
#   "questions": [...],
#   <- no comma because data has only one key
#   <- but there's no closing } for data either!

# After my fix, I want:
# "data": {
#   "questions": [...]
# },
# "explanation_th": "..."  <- sibling to data, not inside
# }

# So I should NOT add a comma after ]. The comma would only be needed if
# data had another key after questions.

# CORRECT fix:
# Replace the section after ] (but not the ] itself) with:
# \n        },\n        "explanation_th": "THAI",\n      }

# Where:
# - \n        } = close data (no comma after questions array since it's the only key)
# - , = comma after explanation_th since there's more content (the closing } of mini_quiz)
# Wait no - explanation_th is the last key in mini_quiz, so no comma needed after it

# Actually looking at valid g4 structure:
# "explanation_th": "...",  <- has comma!
# But wait, what comes after explanation_th? The mini_quiz closing }

# In valid g4:
# "content": { "questions": [...] },
# "explanation_th": "...",  <- comma separates from closing }
# }

# So the comma after explanation_th IS needed!

# The problem is my replacement is adding a comma AFTER questions array
# which is wrong because questions is the last element in data
# But then data object closes with }

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

# The CORRECT new section:
# - Close data with } (no comma after questions)
# - Then explanation_th at mini_quiz level with comma
# - Then closing } for mini_quiz
new_section = '\n        },\n        "explanation_th": "' + THAI + '",\n      }'

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