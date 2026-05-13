import json, shutil

# Debug: show the exact JSON structure and my fix

# Restore fresh
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the problematic section manually
# Looking at lines 249-255 from original:
# Line 249: ] - closes questions array
# Line 250: (empty with spaces)
# Line 251: "explanation_th": "See correct answer above" followed by spaces and }
# Line 252: } - closes mini_quiz
# Line 253: ] - closes something
# Line 254: }, - closes something

# The problem: "explanation_th" is at indent 58 inside "data" which never got a closing }

# My fix replaces the section from after ] to the } after explanation_th

idx = content.find('"explanation_th": "See correct answer above"')
before = content[:idx]
last_bracket = before.rfind(']')
closingbrace = content.find('}', idx)

old_start = last_bracket + 1
old_end = closingbrace + 1

# The CORRECT replacement should produce:
# ],
#         },        <- close data object with comma (data has more content after questions array)
#         "explanation_th": "THAI",  <- explanation at mini_quiz level
#         }     <- close mini_quiz

# So new_section should be:
# ,\n        },\n        "explanation_th": "THAI",\n        }
# Note the comma after ] and the closing } at the end

new_section = ',\n        },\n        "explanation_th": "ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง",\n        }'

print('Original old section:')
print(repr(content[old_start:old_end]))
print()
print('New section:')
print(repr(new_section))
print()

new_content = content[:old_start] + new_section + content[old_end:]

with open(fpath, 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

# Show the result lines
with open(fpath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

print('Result lines 247-255:')
for i in range(246, 256):
    if i < len(lines):
        print(str(i+1) + ': ' + repr(lines[i]))

# Verify
try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print()
    print('VALID JSON!')
except json.JSONDecodeError as e:
    print()
    print('INVALID: ' + e.msg + ' at line ' + str(e.lineno) + ', col ' + str(e.colno))