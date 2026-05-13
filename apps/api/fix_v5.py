#!/usr/bin/env python3
"""Fix grade_2 mini_quiz - correct structure based on g4 analysis.

VALID g4 structure (no "data"):
{
  "type": "mini_quiz",
  "content": { "questions": [...] },
  "explanation_th": "..."
}

BROKEN g2 structure:
{
  "type": "mini_quiz",
  "title_th": "...",
  "data": {
    "questions": [...],
    "explanation_th": "..."    <- WRONG: inside data
  }                             <- MISSING: } to close data
}

FIX: 
1. After ] (close questions), add } to close data
2. explanation_th should be at mini_quiz level (sibling to data), not inside data
3. Add comma after explanation_th value

Target:
{
  "type": "mini_quiz",
  "title_th": "...",
  "data": {
    "questions": [...]
  },
  "explanation_th": "THAI",
}
"""
import os
import json
import shutil

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

# Restore files first
for fname in files:
    src = os.path.join(r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2', fname)
    dst = os.path.join(GRADE2_LESSONS, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f'Restored {fname}')

print()
print('Fixing...')
print()

def fix_content(content):
    # Fix 1: "answer" -> "correct_answer"
    for _ in range(20):
        idx = content.find('"choices":')
        if idx == -1:
            break
        arr_end = content.find(']', idx)
        if arr_end == -1:
            break
        after = content[arr_end+1:arr_end+60]
        if '"answer":' in after:
            content = content[:arr_end+1] + content[arr_end+1:].replace('"answer":', '"correct_answer":', 1)
    
    # Fix 2: explanation_th - fix structure
    # The pattern: ],\n  "explanation_th": "See correct answer above"   }\n}
    # becomes: ],\n  },\n  "explanation_th": "THAI",\n}
    # i.e., close data with }, then explanation_th at sibling level with comma, then } for mini_quiz
    
    for _ in range(20):
        idx = content.find('"explanation_th": "See correct answer above"')
        if idx == -1:
            break
        
        # Find ] that closes questions (backwards from explanation_th)
        before = content[:idx]
        last_bracket = before.rfind(']')
        
        # Find the closing brace for mini_quiz (after explanation_th)
        closing_brace = content.find('}', idx)
        
        # The bad section spans from after ] to the closing }
        # It includes whitespace and the closing brace
        old_section = content[last_bracket+1:closing_brace+1]
        
        # New section: whitespace, },  "explanation_th": "THAI",
        # The whitespace pattern should match the original indentation
        new_section = '\n        },\n        "explanation_th": "' + THAI_EXPLANATION + '",\n      '
        
        content = content[:last_bracket+1] + new_section + content[closing_brace+1:]
    
    return content

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    print(f'Processing {fname}...')
    
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    new_content = fix_content(content)
    
    with open(fpath, 'w', encoding='utf-8-sig') as f:
        f.write(new_content)
    
    # Validate
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        print(f'  SUCCESS')
    except json.JSONDecodeError as e:
        print(f'  FAILED - {e.msg} at line {e.lineno}, col {e.colno}')
    
    print()

print('Done!')