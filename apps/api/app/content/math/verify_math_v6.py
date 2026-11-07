#!/usr/bin/env python3
"""Verify math correctness - use full expression evaluation."""
import json
import re
from pathlib import Path

def safe_eval(expr):
    py_expr = expr.replace('×', '*').replace('÷', '/').replace('x', '*').replace('X', '*').replace(',', '').replace(' ', '')
    try:
        result = eval(py_expr, {"__builtins__": {}}, {})
        return result
    except Exception:
        return None

def find_all_math_in_question(q_str):
    """Find all math expressions in a question and return list of (expr, expected, actual)."""
    issues = []

    # Skip word problems - they have story context
    # Look for explicit equations with = ?
    for expr_match in re.finditer(r'([\d\s.,+\-*/×÷()]+)\s*=\s*\?', q_str):
        expr = expr_match.group(1).strip()
        if re.match(r'^[\d\s.,+\-*/×÷()]+$', expr):
            expected = safe_eval(expr)
            if expected is not None:
                issues.append((expr, expected))

    return issues


def verify_question(q, correct_answer, explanation=''):
    """Returns issue string or None."""
    if not q or not correct_answer:
        return None
    q_str = str(q)

    ans_match = re.search(r'(\d+(?:,\d{3})*(?:\.\d+)?)', str(correct_answer))
    if not ans_match:
        return None
    ans = float(ans_match.group(1).replace(',', ''))

    # Check explicit "X = ?" equations
    # Use a more permissive regex that allows 'x' as multiplication
    for expr_match in re.finditer(r'([\d\s.,+\-*/×÷()xX]+)\s*=\s*\?', q_str):
        expr = expr_match.group(1).strip()
        if re.match(r'^[\d\s.,+\-*/×÷()xX]+$', expr):
            expected = safe_eval(expr)
            if expected is not None:
                if abs(ans - expected) > 0.01:
                    return f"Math mismatch in '{q[:60]}': '{expr}=?' expected {expected}, got {ans}"

    # For word problems: check if numbers in question can derive the answer
    # Don't verify - too many false positives

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
    print("=== MATH VERIFICATION (v6 - question only) ===")
    total1, issues1 = verify_lesson_quiz_questions()
    print(f"Lesson/quiz questions checked: {total1}")
    print(f"Math issues: {len(issues1)}")
    if issues1:
        for fp, iss in issues1[:30]:
            print(f"  {fp}: {iss}")

    total2, issues2 = verify_jsonl_questions()
    print(f"\nQuestion bank questions checked: {total2}")
    print(f"Math issues: {len(issues2)}")
    if issues2:
        for fp, i, iss in issues2[:30]:
            print(f"  {fp}:{i}: {iss}")


if __name__ == '__main__':
    main()
