#!/usr/bin/env python3
"""Fix Thai-in-English issues in EP files by moving content to _th fields."""
import json
import re
import os
from pathlib import Path

THAI_RE = re.compile(r'[\u0E00-\u0E7F]')

def has_thai(s):
    return bool(s and isinstance(s, str) and THAI_RE.search(s))

def fix_question(q):
    """Fix a single question object."""
    fixes = []
    # Field mapping: if X_en contains Thai, move to X_th
    for base in ['question_text', 'explanation']:
        en_key = f'{base}_en'
        th_key = f'{base}_th'
        if en_key in q and has_thai(q[en_key]):
            th_content = q[en_key]
            q[th_key] = th_content
            # Copy from base field if exists
            if base in q:
                q[en_key] = q[base]
            else:
                q[en_key] = ''
            fixes.append(f"Moved Thai from {en_key} to {th_key}")
    return fixes

def fix_lesson_file(path):
    fixes = []
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    # Fix questions array if present
    if 'questions' in data and isinstance(data['questions'], list):
        for q in data['questions']:
            if isinstance(q, dict):
                qfixes = fix_question(q)
                fixes.extend(qfixes)

    # Fix visual_blocks
    def walk_blocks(obj, path=''):
        if isinstance(obj, dict):
            for k, v in list(obj.items()):
                if k.endswith('_en') and has_thai(v):
                    th_key = k[:-3] + '_th'
                    obj[th_key] = v
                    obj[k] = ''
                    fixes.append(f"Moved Thai from {path}.{k} to {th_key}")
                else:
                    walk_blocks(v, f"{path}.{k}" if path else k)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk_blocks(v, f"{path}[{i}]")

    walk_blocks(data)

    if fixes:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return fixes

def main():
    base = Path('apps/api/app/content/math')
    target_files = [
        'grade_3/lessons/EP/division/division_ep_001.json',
        'grade_3/lessons/EP/multiplication/multiplication_ep_001.json',
        'grade_3/lessons/EP/numbers/numbers_ep_001.json',
        'grade_4/quizzes/EP/add_sub_over_100000/add_sub_over_100000_ep_q001.json',
        'grade_4/quizzes/EP/add_sub_over_100000/add_sub_over_100000_ep_q002.json',
        'grade_4/quizzes/EP/angles/angles_ep_q001.json',
        'grade_4/quizzes/EP/angles/angles_ep_q002.json',
        'grade_4/quizzes/EP/data_presentation/data_presentation_ep_q001.json',
        'grade_4/quizzes/EP/data_presentation/data_presentation_ep_q002.json',
        'grade_4/quizzes/EP/decimals/decimals_ep_q001.json',
        'grade_4/quizzes/EP/decimals/decimals_ep_q002.json',
        'grade_4/quizzes/EP/fractions/fractions_ep_q001.json',
        'grade_4/quizzes/EP/fractions/fractions_ep_q002.json',
        'grade_4/quizzes/EP/mixed_operations_whole_numbers/mixed_operations_whole_numbers_ep_q001.json',
        'grade_4/quizzes/EP/mixed_operations_whole_numbers/mixed_operations_whole_numbers_ep_q002.json',
        'grade_4/quizzes/EP/multiplication_division_whole_numbers/multiplication_division_whole_numbers_ep_q001.json',
        'grade_4/quizzes/EP/multiplication_division_whole_numbers/multiplication_division_whole_numbers_ep_q002.json',
        'grade_4/quizzes/EP/numbers_over_100000/numbers_over_100000_ep_q001.json',
        'grade_4/quizzes/EP/numbers_over_100000/numbers_over_100000_ep_q002.json',
        'grade_4/quizzes/EP/rectangles/rectangles_ep_q001.json',
        'grade_4/quizzes/EP/rectangles/rectangles_ep_q002.json',
        'grade_4/quizzes/EP/time/time_ep_q001.json',
        'grade_4/quizzes/EP/time/time_ep_q002.json',
    ]

    for rel in target_files:
        path = base / rel
        if not path.exists():
            print(f"MISSING: {rel}")
            continue
        fixes = fix_lesson_file(path)
        print(f"\n=== {rel} ===")
        for fix in fixes:
            print(f"  [FIXED] {fix}")

if __name__ == '__main__':
    main()
