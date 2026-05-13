#!/usr/bin/env python3
"""Fix grade_2 mini_quiz Schema B issues.

The problems in these files:
1. "answer" -> "correct_answer" in questions with choices
2. "explanation_th" is placed inside "data" object (wrong), should be at mini_quiz level
3. The "data" object is missing its closing }

Fix approach:
- Find each mini_quiz block
- For questions with choices: rename "answer" to "correct_answer"
- Find the "questions" array closing ], then insert },\n  to close data object
- Find the mispositioned "explanation_th" and move it to mini_quiz level with proper closing
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
    
    # Step 1: Fix "answer" -> "correct_answer" in questions with choices
    # Pattern: "text_th": "...", "choices": [...], "answer": "VALUE"
    p1 = r'("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"(\s*:\s*)"([^"]+)("'
    content = re.sub(p1, r'\1"correct_answer"\2"\3\4', content)
    
    # Step 2: Fix the broken data.explanation_th structure
    # The bad pattern in raw text:
    # "questions": [\n...]\n          \n                                       "explanation_th": "VALUE"
    # The ] (closing questions array) is followed by whitespace and then "explanation_th" is at deep indentation
    # This means explanation_th is INSIDE the data object, and data has no closing }
    
    # We need to:
    # 1. After the ] that closes questions array, insert },\n  to close data object
    # 2. Keep explanation_th but add comma after its closing }
    # 3. Ensure proper structure
    
    # Pattern: ] followed by spaces/newlines then "explanation_th"
    # We want: ]\n        },\n        "explanation_th": "VALUE",
    
    # Match: ] followed by whitespace then "explanation_th": "...", spaces, }
    # This pattern captures the entire malformed section
    p2 = r'(\])\s+(\n\s*)("explanation_th":\s*"[^"]+")(\s+)\}'
    match = re.search(p2, content)
    if match:
        # Replace: ]\s+"explanation_th": "VAL"    }\n        }\n      }
        # With: ]\n        },\n        "explanation_th": "VAL",\n      }
        replacement = r'\1\2},\n        \3",\n      }'
        content = re.sub(p2, replacement, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Fixed: {filename}')
        
        # Verify JSON validity
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                json.load(f)
            print(f'  VALID JSON')
            return True
        except json.JSONDecodeError as e:
            print(f'  STILL INVALID: {e}')
            return False
    else:
        print(f'  No changes: {filename}')
        return False

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    if os.path.exists(fpath):
        fix_file(fpath)
    else:
        print(f'SKIP (not found): {fname}')

print('\nDone!')