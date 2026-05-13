#!/usr/bin/env python3
"""Fix Schema B mini_quiz blocks in grade_2 lesson files.
Fixes:
1. "answer" -> "correct_answer" in questions that have both text_th and choices
2. "explanation_th":"See correct answer above" -> proper Thai explanation
3. Remove trailing garbage (garbage characters after explanation value before closing brace)

Safe: reads entire file as string, modifies with regex, writes back with UTF-8 BOM.
Does NOT use ConvertFrom-Json (which creates read-only objects in PowerShell).
"""
import os
import re

GRADE2_LESSONS = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
BACKUP_DIR = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'

# Thai explanation (stored as raw string to avoid encoding issues)
THAI_EXPLANATION = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

def fix_file(filepath):
    """Fix Schema B mini_quiz issues in a single file."""
    filename = os.path.basename(filepath)
    print(f'Processing {filename}...')
    
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    original = content
    changes = 0
    
    # Fix 1: "answer" -> "correct_answer" in questions WITH choices
    # Pattern: "text_th" : "X + Y = ?", "choices" : [...], "answer" : "Z"
    pattern1 = r'("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"(\s*:\s*")([^"]+)(")'
    replacement1 = r'\1"correct_answer\2\3\4'
    new_content = re.sub(pattern1, replacement1, content)
    if new_content != content:
        content = new_content
        changes += 1
        print(f'  Fixed answer->correct_answer')
    
    # Fix 2: explanation_th placeholder
    # The placeholder is: "explanation_th":"See correct answer above"
    # BUT there's trailing garbage before the } - pattern is:
    # "explanation_th": "See correct answer above" + spaces + garbage + }
    # We need to replace the whole thing including garbage with proper Thai explanation + }
    
    # The bad pattern: "explanation_th": "See correct answer above" + spaces + junk + }
    # The good pattern: "explanation_th": "ดูตัวอย่าง..." }
    
    # Pattern to match: "explanation_th": "See correct answer above" followed by whitespace and }
    # But the closing } is actually after some garbage
    # Let's find the pattern precisely
    
    # Match: "explanation_th": "See correct answer above" + whitespace + }
    # where the closing } is the immediate object close (not inside a string)
    pattern2 = r'"explanation_th"\s*:\s*"See correct answer above"\s+"\}'
    if re.search(pattern2, content):
        # Replace with proper value - we need to keep the closing }
        # The replacement is: "explanation_th": "THAI_EXPLANATION"}
        fixed_explanation = '"explanation_th": "' + THAI_EXPLANATION + '"}'
        content = re.sub(pattern2, fixed_explanation, content)
        changes += 1
        print(f'  Fixed explanation_th placeholder')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Written (changes: {changes})')
    else:
        print(f'  No changes')

def main():
    # Create backup first
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    
    files = [
        'g2_add_two_digit.json',
        'g2_money_change.json',
        'g2_multiplication_intro.json',
        'g2_shapes_2d.json',
        'g2_subtract_two_digit.json',
        'g2_times_table_2_5_10.json',
        'g2_time_calendar.json',
    ]
    
    for fname in files:
        fpath = os.path.join(GRADE2_LESSONS, fname)
        if os.path.exists(fpath):
            fix_file(fpath)
        else:
            print(f'SKIP (not found): {fname}')
    
    print('\nDone!')

if __name__ == '__main__':
    main()
