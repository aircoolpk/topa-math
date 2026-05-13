import json

# Verify the original file is broken and understand the EXACT fix needed
fpath = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Check original validity
try:
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print('Original is VALID (unexpected!)')
except json.JSONDecodeError as e:
    print(f'Original is INVALID: {e.msg} at line {e.lineno}, col {e.colno}')

# Now show what my fix should produce
# Original structure (lines 229-255):
# Line 229: "type": "mini_quiz",    (indent 10)
# Line 230: "title_th": "...",      (indent 10)
# Line 231: "data": {               (indent 10)
# Line 232:   "questions": [         (indent 12)
# ...
# Line 249:   ]                      (indent 12) - closes questions array
# Line 250: (spaces)                 (indent 11) - EMPTY LINE
# Line 251: "explanation_th": "..."  (indent 58) - INSIDE data but data has no }
# Line 252: }                        (indent 8)  - closes mini_quiz
# Line 253: ]                        (indent 6)  - closes something
# Line 254: },                       (indent 4)  - closes variant

# My current fix replaces from after ] to the closing } with:
# \n        },\n        "explanation_th": "THAI",\n      }
# This produces:
# Line 249: ]                       (closes questions)
# Line 250: }                       (closes data) with 8 spaces
# Line 251: "explanation_th": "THAI", (10 spaces)
# Line 252: (spaces, 6 spaces)
# Line 253: }                       (closes mini_quiz)

# But JSON says line 251 col 70 has trailing comma - line 251 is:
# '        "explanation_th": "ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง",\n'
# Position 70 is the comma after the Thai text!

# Wait - let me count positions more carefully
line_251 = '        "explanation_th": "ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง",\n'
print(f'Line 251 length: {len(line_251)}')
print(f'Position 69: {repr(line_251[68:72])}')  # 0-indexed, position 69 = col 70
print(f'Position 68: {repr(line_251[67:71])}')
print(f'Position 70: {repr(line_251[69:73])}')
print()

# The error says col 70 has trailing comma
# Col 70 = position 69 (0-indexed)
# Position 69 is the comma!
print(f'Char at position 69: {repr(line_251[69])}')
print()

# The comma is there to separate from the next key, but after it there's newline
# and then line 252 has just spaces then }
# So the structure is:
# "explanation_th": "THAI",  <- line 251 (comma at end)
# (line 252: spaces)
# }                             <- line 253

# But wait - what's at line 252 position? The error says the comma is "before end of object"
# This suggests the object being closed at line 253's } is the mini_quiz block
# And the comma after explanation_th is inside the object

# Let me look at what the FIXED lines should be:
# Line 249: ]        (closes questions array)
# Line 250: },       (closes data object - with comma because there's more after)
# Line 251: "explanation_th": "THAI", (explanation at mini_quiz level)
# Line 252: (spaces)
# Line 253: }        (closes mini_quiz block)

# But currently my fix produces line 251 with comma at end, then line 252 with spaces, then line 253 with }
# The problem might be that line 250 is "},\n" (closes data with comma)
# and line 251 is "explanation_th..." at indent 8
# Then line 252 is "      \n" (6 spaces)
# Then line 253 is "        }\n" (8 spaces)

# This seems correct! The comma at line 251 is valid because explanation_th is followed by }
# which closes the mini_quiz object.

# But wait - the error says "Illegal trailing comma before end of object at line 251, col 70"
# The object being closed is the mini_quiz block
# The comma after explanation_th is INSIDE the object
# After the comma, we have:
# - Line 252: just spaces (no content)
# - Line 253: }

# The problem might be that after the comma, we have EMPTY LINE then }
# JSON might not like that the comma is immediately followed by newline and then more whitespace before }

# Let me check: does line 252 have actual content or just spaces?
print('Line 252 content:')
print(repr(line_251))  # This is still line 251 from my variable
# Let me re-check the fixed file
fpath2 = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(fpath2, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()
print()
print('Fixed file around line 251:')
for i in range(248, 256):
    print(f'Line {i+1}: {repr(lines[i])}')