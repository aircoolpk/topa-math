#!/usr/bin/env python3
"""Debug and fix explanation_th placeholder in grade_2 files."""

import os
import re

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

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # Find all occurrences of the bad pattern
    # "explanation_th": "See correct answer above" followed by whitespace then }
    pattern = r'"explanation_th"\s*:\s*"See correct answer above"(\s+)\}'
    
    matches = list(re.finditer(pattern, content))
    print(f'{fname}: {len(matches)} bad explanation_th patterns found')
    
    if matches:
        # Show first match context
        m = matches[0]
        start = max(0, m.start() - 50)
        end = min(len(content), m.end() + 50)
        print(f'  First match at char {m.start()}: ...{repr(content[start:end])}...')
        
        # Fix: replace with proper Thai explanation
        # New pattern: "explanation_th": "THAI"}\n        }
        # The closing } is actually followed by more JSON (},\n        })
        # We need to match the whitespace before } and preserve structure
        fixed = '"explanation_th": "' + THAI_EXPLANATION + '"'
        content = re.sub(pattern, fixed + r'\1}', content)
        
        with open(fpath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Fixed {len(matches)} occurrences')
    print()