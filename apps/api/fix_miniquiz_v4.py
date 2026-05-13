#!/usr/bin/env python3
"""Fix grade_2 mini_quiz Schema B - based on actual structure analysis.

After analyzing both valid g4 and broken g2 structures:

VALID g4 mini_quiz (content-based, no explanation_th):
  {
    "type": "mini_quiz",
    "content": {
      "questions": [...]
    }
  }

BROKEN g2 mini_quiz (data-based, with misplaced explanation_th):
  {
    "type": "mini_quiz",
    "data": {
      "questions": [...]
      "explanation_th": "..."  <-- WRONG: inside data, should be at mini_quiz level
    }  <-- MISSING closing }
  }

The broken block ends with:
  ]
                    "explanation_th": "See correct answer above"    }
              }
            ]
          },
  
The fix:
  1. After ] (close questions), add } to close data object
  2. Move explanation_th to mini_quiz level (it already is positionally, but needs comma)
  3. Add comma after explanation_th value

Target structure:
  "data": {
    "questions": [...]
  },
  "explanation_th": "...",
}
"""
import os
import re
import json

GRADE2_LESSONS = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
THAI_EXPLANATION = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

files = [
    'g2_add_two_digit.json',
    'g2_money_change.json',
    'g2_multiplication_intro.json',
    'g2_shapes_2d.json',
    'g2_subtract_two_digit.json',
    'g2_times_table_2_5_10.json',
    'g2_time_calendar.json',
]

def fix_file(filepath):
    filename = os.path.basename(filepath)
    print(f'Processing {filename}...')
    
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    original = content
    
    # Fix 1: "answer" -> "correct_answer" in questions with choices
    changes1 = 0
    while True:
        idx = content.find('"choices":')
        if idx == -1:
            break
        arr_end = content.find(']', idx)
        if arr_end == -1:
            break
        after = content[arr_end+1:arr_end+50]
        if '"answer":' in after:
            content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
            changes1 += 1
        else:
            idx = arr_end + 1
    print(f'  Fixed {changes1} answer->correct_answer')
    
    # Fix 2: explanation_th structure
    # The problematic pattern (from byte analysis):
    # ],  (close questions)
    #     (lots of whitespace)  
    #                         "explanation_th": "See correct answer above"        }
    #                                                     (spaces then } for mini_quiz)
    #
    # The ] that closes questions has 10 spaces after it (indentation for questions array close)
    # Then 60+ spaces of indentation before "explanation_th"
    # Then 60+ spaces before } that closes mini_quiz
    
    # We need to:
    # ],\n        }\n        "explanation_th": "THAI",\n      }
    
    # Count placeholders
    exp_count = content.count('"explanation_th": "See correct answer above"')
    print(f'  Found {exp_count} explanation_th placeholders')
    
    # For each placeholder, do the targeted fix
    for i in range(exp_count):
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        # Find the ] that closes questions array (search backwards)
        before = content[:idx]
        last_bracket = before.rfind(']')
        
        # Find the closing brace for mini_quiz (right after the placeholder + spaces)
        closingbrace_idx = content.find('}', idx)
        
        if closingbrace_idx != -1:
            # Get the section from ] to the closing brace
            old_section = content[last_bracket:closingbrace_idx+1]
            
            # New section: close questions with ], then close data with }, then explanation_th with comma
            new_section = '],\n        },\n        "explanation_th": "' + THAI_EXPLANATION + '",\n      '
            
            content = content[:last_bracket] + new_section + content[closingbrace_idx+1:]
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Written changes')
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                json.load(f)
            print(f'  VALID JSON')
            return True
        except json.JSONDecodeError as e:
            print(f'  STILL INVALID: {e}')
            return False
    else:
        print(f'  No changes')
        return False

# Restore all files first
for fname in files:
    src = os.path.join(r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2', fname)
    dst = os.path.join(GRADE2_LESSONS, fname)
    if os.path.exists(src):
        import shutil
        shutil.copy2(src, dst)
        print(f'Restored {fname}')

print('\nNow fixing...\n')

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    result = fix_file(fpath)
    print(f'  Result: {"SUCCESS" if result else "FAILED"}')
    print()

print('Done!')