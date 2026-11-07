#!/usr/bin/env python3
"""Verify math correctness - focus on question/answer math only."""
import json
import re
from pathlib import Path

def parse_num(s):
    return float(s.replace(',', ''))

def safe_eval(expr):
    py_expr = expr.replace('×', '*').replace('÷', '/').replace(',', '').replace(' ', '')
    try:
        return eval(py_expr, {"__builtins__": {}}, {})
    except Exception:
        return None

def verify_question(q, correct_answer, explanation=''):
    """Verify math. Returns issue string or None."""
    if not q or not correct_answer:
        return None
    q_str = str(q)

    ans_match = re.search(r'(\d+(?:,\d{3})*(?:\.\d+)?)', str(correct_answer))
    if not ans_match:
        return None
    ans = parse_num(ans_match.group(1))

    # Find equation "X op Y ... = ?" pattern (question has ?)
    expr_match = re.search(r'([\d\s\.,+\-*/×÷()]+)\s*=\s*\?', q_str)
    if expr_match:
        expr = expr_match.group(1).strip()
        if re.match(r'^[\d\s.,+\-*/×÷()]+$', expr):
            expected = safe_eval(expr)
            if expected is not None:
                if abs(float(ans) - float(expected)) > 0.01:
                    return f"Math mismatch in '{q[:60]}': expected {expected}, got {ans}"
        return None

    # Check explanation for clean "X = Y" pattern (single equation)
    if explanation:
        exp_str = str(explanation)
        # Find first simple equation with no parens (simple X+Y=Z)
        # Skip multi-step explanations (with "แล้ว", "then", "|", multiple "=")
        if exp_str.count('=') > 2:
            return None  # Multi-step
        if 'แล้ว' in exp_str or 'then' in exp_str.lower() or '|' in exp_str:
            return None  # Multi-step

        # Find "X op Y = Z" pattern with single operator
        m = re.search(r'(\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:,\d{3})*(?:\.\d+)?)', exp_str)
        if m:
            a, op, b, claimed = float(m.group(1)), m.group(2), float(m.group(3)), float(m.group(4).replace(',', ''))
            if op == '+':
                expected = a + b
            elif op == '-':
                expected = a - b
            elif op in 'x×*':
                expected = a * b
            elif op in '/÷':
                expected = a / b if b else 0
            else:
                return None
            if abs(expected - claimed) > 0.01:
                return f"Bad calculation: {a}{op}{b}={claimed} but should be {expected}"

    return None


def verify_jsonl_questions():
    base = Path('apps/api/app/content/math/question_banks')
    issues = []
    total = 0
    for grade in range(1, 7):
        d = base / f'grade_{grade}'
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
                    exp = obj.get('explanation_en') or obj.get('explanation_th', '')
                    issue = verify_question(q, ans, exp)
                    if issue:
                        issues.append((str(fp), i, issue))
    return total, issues


def verify_lesson_quiz_questions():
    base = Path('apps/api/app/content/math')
    issues = []
    total = 0
    for grade in range(1, 7):
        for sub in ['lessons', 'quizzes']:
            d = base / f'grade_{grade}' / sub
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
                    exp = q.get('explanation_en', '') or q.get('explanation', '') or q.get('explanation_th', '')
                    issue = verify_question(qt, ans, exp)
                    if issue:
                        issues.append((str(fp), issue))

                for vb in data.get('visual_blocks', []):
                    if vb.get('type') == 'mini_quiz':
                        total += 1
                        q = vb.get('question', '')
                        ans = vb.get('correct_answer', '')
                        exp = vb.get('explanation', '')
                        issue = verify_question(q, ans, exp)
                        if issue:
                            issues.append((str(fp), issue))
    return total, issues


def main():
    print("=== MATH VERIFICATION (v5 - question-based) ===")
    total1, issues1 = verify_lesson_quiz_questions()
    print(f"Lesson/quiz questions checked: {total1}")
    print(f"Real math issues: {len(issues1)}")
    if issues1:
        for fp, iss in issues1[:30]:
            print(f"  {fp}: {iss}")

    total2, issues2 = verify_jsonl_questions()
    print(f"\nQuestion bank questions checked: {total2}")
    print(f"Real math issues: {len(issues2)}")
    if issues2:
        for fp, i, iss in issues2[:30]:
            print(f"  {fp}:{i}: {iss}")


if __name__ == '__main__':
    main()
