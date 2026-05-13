#!/usr/bin/env python3
"""Fix answer->correct_answer in grade_2 lesson files.
The previous regex had a bug: it captured the colon inside the replacement,
producing "correct_answer: "45"" instead of "correct_answer": "45".
"""
import os
import re

GRADE2_LESSONS = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'

files = [
    'g2_add_two_digit.json',
    'g2_money_change.json',
    'g2_multiplication_intro.json',
    'g2_shapes_2d.json',
    'g2_subtract_two_digit.json',
    'g2_times_table_2_5_10.json',
    'g2_time_calendar.json',
]

# Correct regex pattern
# Match: "text_th": "...", "choices": [...], "answer": "VALUE"
# Group 1: everything before "answer" key
# Group 2: "answer" (the key itself)
# Group 3: ": " (colon + space)
# Group 4: the value
# Group 5: closing quote
pattern = r'("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"(\s*:\s*)"([^"]+)("'
replacement = r'\1"correct_answer"\3"\4"'

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # First check: find any "correct_answer: " (missing colon after key)
    bad_pattern = r'"correct_answer: "'
    bad_matches = list(re.finditer(bad_pattern, content))
    if bad_matches:
        print(f'{fname}: Found {len(bad_matches)} broken "correct_answer: " patterns')
        
        # Fix: replace "correct_answer: " with "correct_answer": "
        content = content.replace('"correct_answer: "', '"correct_answer": "')
        
        with open(fpath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Fixed broken colons')
    else:
        print(f'{fname}: No broken colons found')

print('\nDone!')