#!/usr/bin/env python3
"""Fix grade_2 mini_quiz Schema B issues - precise replacement."""
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
    changes = 0
    
    # Fix 1: "answer" -> "correct_answer" in questions with choices
    # Find "choices": [...] followed by "answer":
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
            changes += 1
        else:
            idx = arr_end + 1
    
    print(f'  Fixed {changes} answer->correct_answer occurrences')
    
    # Fix 2: explanation_th structure
    # The bad pattern:
    # ],
    #           (spaces)
    #                                                           "explanation_th": "See correct answer above"     (spaces)     }
    #        }  (closing something)
    #      ]   (closing something)
    #    },
    #
    # Should become:
    # ],
    #         },
    #         "explanation_th": "THAI",
    #       }
    #
    # I.e., after ] (close questions), we close content with }, then explanation_th with comma, then } for mini_quiz
    
    exp_count = content.count('"explanation_th": "See correct answer above"')
    print(f'  Found {exp_count} explanation_th placeholders')
    
    # For each placeholder, do the replacement
    for i in range(exp_count):
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        # Find the ] that closes questions array (look backwards)
        before = content[:idx]
        last_bracket = before.rfind(']')
        
        # Get everything from ] to the closing } after explanation_th
        # The closing } is the one right after the spaces following the placeholder
        closingbrace_idx = content.find('}', idx)
        
        if closingbrace_idx != -1:
            old_section = content[last_bracket:closingbrace_idx+1]
            # Build new section
            new_section = (
                '],\n'
                '        },\n'
                '        "explanation_th": "' + THAI_EXPLANATION + '",\n'
                '      '
            )
            content = content[:last_bracket] + new_section + content[closingbrace_idx+1:]
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Written')
        
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

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    if os.path.exists(fpath):
        result = fix_file(fpath)
        if result:
            print(f'  SUCCESS')
        else:
            print(f'  FAILED - restore needed')
    else:
        print(f'SKIP: {fname}')
    print()

print('Done!')