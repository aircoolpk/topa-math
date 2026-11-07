#!/usr/bin/env python3
"""Validate all TOPA Math content files."""
import json
import os
import re
from pathlib import Path

THAI_RE = re.compile(r'[\u0E00-\u0E7F]')

THAI_ALLOWED_SUFFIXES = ('_th',)
THAI_ALLOWED_EXACT = {'th', '_th'}


def has_thai(s):
    return bool(s and isinstance(s, str) and THAI_RE.search(s))


def is_thai_allowed_field(name):
    if name in THAI_ALLOWED_EXACT:
        return True
    for suf in THAI_ALLOWED_SUFFIXES:
        if name.endswith(suf):
            return True
    return False


def check_lesson_file(path, kind):
    issues = []
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"JSON parse error: {e}"]
    except Exception as e:
        return [f"Read error: {e}"]

    if data.get('status') != 'needs_review':
        issues.append(f"Status is {data.get('status')!r} (must be 'needs_review')")

    def walk(obj, path=''):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, f"{path}[{i}]")
        elif isinstance(obj, str):
            field_name = path.split('.')[-1] if '.' in path else path
            field_name = field_name.split('[')[0]
            if kind == 'EP' and has_thai(obj) and not is_thai_allowed_field(field_name):
                issues.append(f"Thai in non-Thai field '{field_name}' at {path}: {obj[:80]!r}")

    walk(data)
    return issues


def main():
    base = Path('apps/api/app/content/math')
    total = 0
    bad = 0
    issues_per_file = {}

    for grade in range(1, 7):
        for sub in ['lessons', 'quizzes']:
            d = base / f'grade_{grade}' / sub
            if not d.exists():
                continue
            for fp in sorted(d.rglob('*.json')):
                if any(p in fp.parts for p in ['backup_', '_content_backups', '_archived_legacy_not_loaded', 'old', 'curriculum']):
                    continue
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
                        is_ep = '_ep' in fp.stem.lower() or 'EP' in fp.parts
                        if is_ep:
                            if not obj.get('question_text_en'):
                                file_issues.append(f"Line {i}: missing/empty question_text_en")
                        else:
                            if not obj.get('question_text_th'):
                                file_issues.append(f"Line {i}: missing/empty question_text_th")
                        if not obj.get('correct_answer'):
                            file_issues.append(f"Line {i}: missing/empty correct_answer")
                if file_issues:
                    qb_bad += 1
                    qb_issues[str(fp)] = file_issues

    print("=== VALIDATION REPORT ===")
    print(f"Lesson/quiz files reviewed: {total}")
    print(f"Lesson/quiz files with issues: {bad}")
    print(f"Question bank files reviewed: {qb_total}")
    print(f"Question bank files with issues: {qb_bad}")
    print()
    print("=== ISSUES BY FILE (lessons/quizzes) ===")
    for fp, iss in sorted(issues_per_file.items()):
        print(f"\n{fp}")
        for i in iss[:5]:
            print(f"  - {i}")
        if len(iss) > 5:
            print(f"  ... and {len(iss)-5} more")


if __name__ == '__main__':
    main()
