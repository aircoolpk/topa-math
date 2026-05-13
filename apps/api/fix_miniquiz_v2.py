#!/usr/bin/env python3
"""Fix grade_2 mini_quiz Schema B issues - simplified approach."""
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
    
    # Step 1: Fix "answer" -> "correct_answer" in questions with choices
    # Simple string replace for "answer": "VALUE" that comes after choices array
    # Find pattern: "choices": [...], "answer": "
    while True:
        # Find "choices": [...] followed by "answer":
        idx = content.find('"choices":')
        if idx == -1:
            break
        # Find the end of choices array
        arr_end = content.find(']', idx)
        if arr_end == -1:
            break
        # Check what's after ]
        after = content[arr_end+1:arr_end+50]
        if '"answer":' in after:
            # Replace "answer": with "correct_answer":
            content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
        else:
            # Move past this choices
            idx = arr_end + 1
    
    # Step 2: Fix explanation_th - it's placed wrongly inside data object
    # Find pattern: ]\s+\n\s+"explanation_th": "VALUE"   }
    # This appears as: ],  "explanation_th": "..."
    # where there are lots of spaces after "explanation_th": "..." before }
    
    # Count how many explanation_th with the placeholder we have
    exp_count = content.count('"explanation_th": "See correct answer above"')
    print(f'  Found {exp_count} placeholder explanation_th')
    
    # For each occurrence, we need to fix the structure
    # The bad pattern: "explanation_th": "See correct answer above" followed by lots of spaces then }
    # We need to transform to proper structure
    
    for i in range(exp_count):
        # Find the placeholder
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        # Find the ] that precedes this (end of questions array)
        # Search backwards from idx to find ]
        before = content[:idx]
        last_bracket = before.rfind(']')
        
        # Get context around the bracket
        context_start = max(0, last_bracket - 20)
        context_end = min(len(content), idx + 100)
        
        # The ] should be followed by whitespace then "explanation_th"
        # We need to insert },\n  after ] and before the whitespace
        
        # Actually looking at the byte analysis:
        # Char 6651 is the last space before "explanation_th"
        # Char 6652 is the " 
        # So ] is at around char 6634, followed by lots of spaces then explanation_th
        
        # Replace: ],  "explanation_th": "VALUE"  }\n
        # With: ],\n        },\n        "explanation_th": "VALUE",\n      }
        
        # Find the exact sequence: ] + spaces + "explanation_th"
        # The pattern: ]\s+\n\s+"explanation_th"
        bracket_idx = last_bracket
        # Find where the whitespace starts after ]
        ws_start = bracket_idx + 1
        # Find where "explanation_th" starts
        exp_start = content.find('"explanation_th"', ws_start)
        
        if exp_start > bracket_idx:
            # We have spaces between ] and "explanation_th"
            spaces_between = content[ws_start:exp_start]
            # Get the full explanation_th line and trailing }
            exp_line_end = content.find('}', exp_start)
            if exp_line_end != -1:
                # Get everything from ] to end of }
                old_section = content[bracket_idx:exp_line_end+1]
                # Build new section
                new_section = '],\n        },\n        ' + content[exp_start:exp_line_end] + '",\n      }'
                content = content[:bracket_idx] + new_section + content[exp_line_end+1:]
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Written changes')
        
        # Verify
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
        fix_file(fpath)
    else:
        print(f'SKIP: {fname}')
    print()

print('Done!')