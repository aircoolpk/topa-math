#!/usr/bin/env python3
"""Verify math correctness - improved."""
import json
import re
from pathlib import Path

def parse_num(s):
    return float(s.replace(',', ''))

def verify_question(q, correct_answer, explanation=''):
    """Try to verify the math. Returns issue string or None."""
    if not q or not correct_answer:
        return None
    q_str = str(q)

    # Find numeric value of answer
    ans_match = re.search(r'(\d+(?:,\d{3})*(?:\.\d+)?)', str(correct_answer))
    if not ans_match:
        return None
    ans = parse_num(ans_match.group(1))

    # Try equation format: "X op Y op Z = ?"
    # Find expression before "= ?"
    expr_match = re.search(r'([\d\s\.,+\-*/×÷()]+)\s*=\s*\?', q_str)
    if expr_match:
        expr = expr_match.group(1).strip()
        # Sanitize: only digits, spaces, dots, commas, operators, parens
        if re.match(r'^[\d\s.,+\-*/×÷()]+$', expr):
            # Convert to Python eval-safe expression
            py_expr = expr.replace('×', '*').replace('÷', '/').replace(',', '').replace(' ', '')
            try:
                expected = eval(py_expr)
                if abs(float(ans) - float(expected)) > 0.01:
                    return f"Math mismatch in '{q[:60]}': expected {expected}, got {ans} (expr: {expr})"
            except (SyntaxError, ZeroDivisionError, ValueError, NameError):
                pass
        return None

    # Check explanation for calculation
    if explanation:
        exp_str = str(explanation)
        # Look for "X = result" pattern in explanation
        eq_in_exp = re.search(r'(\d+(?:\.\d+)?)\s*[+\-*/×÷]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)', exp_str)
        if eq_in_exp:
            try:
                a = float(eq_in_exp.group(1))
                b = float(eq_in_exp.group(2))
                claimed = float(eq_in_exp.group(3).replace(',', ''))
                op_char = eq_in_exp.group(0)[len(eq_in_exp.group(1)):].strip()[0]
                if op_char == '+':
                    actual = a + b
                elif op_char == '-':
                    actual = a - b
                elif op_char in 'x×*':
                    actual = a * b
                elif op_char in '/÷':
                    actual = a / b if b else 0
                else:
                    return None
                if abs(actual - claimed) > 0.01:
                    return f"Bad calculation in explanation '{exp_str[:60]}': {a}{op_char}{b}={claimed} but should be {actual}"
            except (ValueError, IndexError):
                pass

    return None

def verify_jsonl_questions():
    """Verify all question banks."""
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
    """Verify all lesson/quiz files."""
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
    print("=== MATH VERIFICATION (improved) ===")
    total1, issues1 = verify_lesson_quiz_questions()
    print(f"Lesson/quiz questions checked: {total1}")
    print(f"Issues: {len(issues1)}")
    if issues1:
        for fp, iss in issues1[:20]:
            print(f"  {fp}: {iss}")

    total2, issues2 = verify_jsonl_questions()
    print(f"\nQuestion bank questions checked: {total2}")
    print(f"Issues: {len(issues2)}")
    if issues2:
        for fp, i, iss in issues2[:20]:
            print(f"  {fp}:{i}: {iss}")

if __name__ == '__main__':
    main()
