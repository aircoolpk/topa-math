#!/usr/bin/env python3
"""Fix grade_2 mini_quiz Schema B - simple single-pass approach."""
import os
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

def simple_replace(content):
    """Do simple string replacements without loops."""
    
    # Fix 1: "answer" -> "correct_answer" when followed by choices
    # Only fix the first occurrence per question (there are 3 questions per block)
    for _ in range(10):  # Max 10 blocks per file
        idx = content.find('"choices":')
        if idx == -1:
            break
        arr_end = content.find(']', idx)
        if arr_end == -1:
            break
        # Check if "answer" follows
        after = content[arr_end+1:arr_end+60]
        if '"answer":' in after:
            content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
    
    # Fix 2: explanation_th placeholder - need to find pattern
    # Bad pattern: "explanation_th": "See correct answer above" followed by spaces and }
    # The placeholder appears 10 times per file
    
    for _ in range(10):  # Max 10 mini_quiz blocks
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        # Find the ] that precedes (closing questions array)
        before = content[:idx]
        last_bracket = before.rfind(']')
        
        # Find the closing } after the placeholder
        closingbrace_idx = content.find('}', idx)
        
        if closingbrace_idx != -1:
            old_section = content[last_bracket:closingbrace_idx+1]
            new_section = '],\n        },\n        "explanation_th": "' + THAI_EXPLANATION + '",\n      '
            content = content[:last_bracket] + new_section + content[closingbrace_idx+1:]
    
    return content

# Restore files first
for fname in files:
    import shutil
    src = os.path.join(r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2', fname)
    dst = os.path.join(GRADE2_LESSONS, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f'Restored {fname}')

print()
print('Fixing files...')
print()

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    print(f'Processing {fname}...')
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    new_content = simple_replace(content)
    
    with open(fpath, 'w', encoding='utf-8-sig') as f:
        f.write(new_content)
    
    # Validate
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        print(f'  SUCCESS - valid JSON')
    except json.JSONDecodeError as e:
        print(f'  FAILED - {e.msg} at line {e.lineno}')
    print()

print('Done!')