#!/usr/bin/env python3
"""Verify math - handle fractions in answers."""
import json
import re
from fractions import Fraction
from pathlib import Path

def safe_eval(expr):
    py_expr = expr.replace(chr(0x00D7), '*').replace(chr(0x00F7), '/').replace('x', '*').replace('X', '*').replace(',', '').replace(' ', '')
    try:
        return eval(py_expr, {"__builtins__": {}}, {})
    except Exception:
        return None

def parse_answer(ans_str):
    """Parse answer as float or fraction."""
    s = str(ans_str).strip()
    # Try fraction like "3/8"
    frac_m = re.match(r'^(-?\d+)/(\d+)$', s)
    if frac_m:
        try:
            return float(Fraction(int(frac_m.group(1)), int(frac_m.group(2))))
        except (ValueError, ZeroDivisionError):
            return None
    # Extract first number
    num_m = re.search(r'(-?\d+(?:,\d{3})*(?:\.\d+)?)', s)
    if num_m:
        return float(num_m.group(1).replace(',', ''))
    return None


def verify_question(q, correct_answer):
    if not q or not correct_answer:
        return None
    q_str = str(q)
    ans = parse_answer(correct_answer)
    if ans is None:
        return None
    # Find equation
    for expr_match in re.finditer(r'([\d\s.,+\-*/xX()]+)\s*=\s*\?', q_str):
        expr = expr_match.group(1).strip()
        if re.match(r'^[\d\s.,+\-*/xX()]+$', expr):
            expected = safe_eval(expr)
            if expected is not None:
                if abs(ans - expected) > 0.01:
                    return "Math mismatch in '" + q[:60] + "': '" + expr + "=?' expected " + str(expected) + ", got " + str(ans)
    return None


def verify_jsonl():
    base = Path('apps/api/app/content/math/question_banks')
    issues = []
    total = 0
    for grade in range(1, 7):
        d = base / ('grade_' + str(grade))
        if not d.exists():
            continue
        for fp in sorted(d.glob('*.jsonl')):
            with open(fp, encoding='utf-8') as f:
                for i, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except:
                        continue
                    total += 1
                    q = obj.get('question_text_en') or obj.get('question_text_th', '')
                    ans = obj.get('correct_answer', '')
                    issue = verify_question(q, ans)
                    if issue:
                        issues.append((str(fp), i, issue))
    return total, issues


def verify_lesson_quiz():
    base = Path('apps/api/app/content/math')
    issues = []
    total = 0
    for grade in range(1, 7):
        for sub in ['lessons', 'quizzes']:
            d = base / ('grade_' + str(grade)) / sub
            if not d.exists():
                continue
            for fp in sorted(d.rglob('*.json')):
                if any(p in fp.parts for p in ['backup_', 'old', 'curriculum']):
                    continue
                if not any(p in fp.parts for p in ['EP', 'TH']):
                    continue
                try:
                    with open(fp, encoding='utf-8') as f:
                        data = json.load(f)
                except:
                    continue
                for q in data.get('questions', []):
                    total += 1
                    qt = q.get('question_text_en', '') or q.get('question_text', '') or q.get('question_text_th', '') or q.get('question_en', '') or q.get('question_th', '')
                    ans = q.get('correct_answer', '') or q.get('answer', '')
                    issue = verify_question(qt, ans)
                    if issue:
                        issues.append((str(fp), issue))
                for vb in data.get('visual_blocks', []):
                    if vb.get('type') == 'mini_quiz':
                        total += 1
                        q = vb.get('question', '')
                        ans = vb.get('correct_answer', '')
                        issue = verify_question(q, ans)
                        if issue:
                            issues.append((str(fp), issue))
    return total, issues


def main():
    print("=== MATH VERIFICATION (v8 - fractions supported) ===")
    t1, i1 = verify_lesson_quiz()
    print("Lesson/quiz questions checked: " + str(t1))
    print("Math issues: " + str(len(i1)))
    for fp, iss in i1[:30]:
        print("  " + fp + ": " + iss)
    print()
    t2, i2 = verify_jsonl()
    print("Question bank questions checked: " + str(t2))
    print("Math issues: " + str(len(i2)))
    for fp, i, iss in i2[:30]:
        print("  " + fp + ":" + str(i) + ": " + iss)


if __name__ == '__main__':
    main()
