#!/usr/bin/env python3
"""Validate all TOPA Math content files."""
import json
import os
import re
import sys
from pathlib import Path

THAI_RE = re.compile(r'[\u0E00-\u0E7F]')

def has_thai(s):
    return bool(s and THAI_RE.search(s))

def check_lesson_file(path, kind):
    """kind is 'EP' or 'TH'."""
    issues = []
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"JSON parse error: {e}"]
    except Exception as e:
        return [f"Read error: {e}"]

    # Required fields
    if 'variant_id' not in data:
        issues.append("Missing variant_id")
    if data.get('status') != 'needs_review':
        issues.append(f"Status is {data.get('status')!r} (must be 'needs_review')")

    # Check _en vs _th fields based on kind
    if kind == 'EP':
        # Walk through all strings
        for key, val in data.items():
            if isinstance(val, str):
                if key.endswith('_en') and has_thai(val):
                    issues.append(f"Thai characters in _en field '{key}'")
    elif kind == 'TH':
        for key, val in data.items():
            if isinstance(val, str):
                if key.endswith('_th') and val and not has_thai(val):
                    issues.append(f"No Thai in _th field '{key}' (value: {val[:50]!r})")

    # Walk recursively into blocks
    def walk(obj, path=''):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, f"{path}[{i}]")
        elif isinstance(obj, str):
            # Only check certain fields for Thai (not all fields need to be English)
            field_name = path.split('.')[-1] if '.' in path else path
            if kind == 'EP' and has_thai(obj):
                # Skip _th fields
                if not (field_name == '_th' or field_name.endswith('_th')):
                    issues.append(f"Thai at {path}: {obj[:60]!r}")

    walk(data)

    return issues

def main():
    base = Path('apps/api/app/content/math')
    total = 0
    bad = 0
    issues_per_file = {}

    for grade in range(1, 7):
        for kind, sub in [('lessons', 'lessons'), ('quizzes', 'quizzes')]:
            d = base / f'grade_{grade}' / sub
            if not d.exists():
                continue
            for fp in sorted(d.rglob('*.json')):
                if any(p in fp.parts for p in ['backup_', '_content_backups', '_archived_legacy_not_loaded', 'lessons old', 'quizzes old', 'curriculum']):
                    continue
                # Determine kind
                if 'EP' in fp.parts:
                    kind_f = 'EP'
                elif 'TH' in fp.parts:
                    kind_f = 'TH'
                else:
                    continue
                total += 1
                issues = check_lesson_file(fp, kind_f)
                if issues:
                    bad += 1
                    issues_per_file[str(fp)] = issues

    # Question banks (JSONL)
    qb_total = 0
    qb_bad = 0
    qb_issues = {}
    qb_dir = base / 'question_banks'
    if qb_dir.exists():
        for grade in range(1, 7):
            d = qb_dir / f'grade_{grade}'
            if not d.exists():
                continue
            for fp in sorted(d.glob('*.jsonl')):
                qb_total += 1
                file_issues = []
                with open(fp, encoding='utf-8') as f:
                    for i, line in enumerate(f, 1):
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError as e:
                            file_issues.append(f"Line {i}: JSON error {e}")
                            continue
                        for field in ['question', 'answer']:
                            if field not in obj or not obj[field]:
                                file_issues.append(f"Line {i}: missing/empty {field}")
                        if 'options' in obj and isinstance(obj['options'], list) and len(obj['options']) < 2:
                            file_issues.append(f"Line {i}: too few options")
                        # Check for Thai in EP files
                        if 'EP' in fp.stem.upper() or '_ep' in fp.stem.lower():
                            text = obj.get('question', '') + ' ' + obj.get('explanation', '')
                            if has_thai(text):
                                file_issues.append(f"Line {i}: Thai in EP file")
                if file_issues:
                    qb_bad += 1
                    qb_issues[str(fp)] = file_issues

    print(f"=== VALIDATION REPORT ===")
    print(f"Lesson/quiz files reviewed: {total}")
    print(f"Lesson/quiz files with issues: {bad}")
    print(f"Question bank files reviewed: {qb_total}")
    print(f"Question bank files with issues: {qb_bad}")
    print()
    print("=== ISSUES BY FILE (lessons/quizzes) ===")
    for fp, iss in sorted(issues_per_file.items()):
        print(f"\n{fp}")
        for i in iss:
            print(f"  - {i}")
    print()
    print("=== ISSUES BY FILE (question banks) ===")
    for fp, iss in sorted(qb_issues.items()):
        print(f"\n{fp}")
        for i in iss[:5]:
            print(f"  - {i}")
        if len(iss) > 5:
            print(f"  ... and {len(iss)-5} more")

if __name__ == '__main__':
    main()
