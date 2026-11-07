#!/usr/bin/env python3
"""Verify math correctness across all content."""
import json
import re
from pathlib import Path

# Patterns
ADD_RE = re.compile(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*\+\s*(\d+(?:,\d{3})*(?:\.\d+)?)')
SUB_RE = re.compile(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*-\s*(\d+(?:,\d{3})*(?:\.\d+)?)')
MUL_RE = re.compile(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*[\*x×]\s*(\d+(?:,\d{3})*(?:\.\d+)?)')
DIV_RE = re.compile(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*[÷/]\s*(\d+(?:,\d{3})*(?:\.\d+)?)')

def parse_num(s):
    return float(s.replace(',', ''))

def verify_question(q, correct_answer, explanation=''):
    """Try to verify the math. Returns issue string or None."""
    if not q or not correct_answer:
        return None
    q_str = str(q)
    exp_str = str(explanation)

    # Find numeric value of answer
    ans_match = re.search(r'(\d+(?:,\d{3})*(?:\.\d+)?)', str(correct_answer))
    if not ans_match:
        return None
    ans = parse_num(ans_match.group(1))

    # Try equation format: "5+3=?"
    eq = re.search(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*=\s*\?', q_str)
    if eq:
        a, op, b = parse_num(eq.group(1)), eq.group(2), parse_num(eq.group(3))
        if op == '+':
            expected = a + b
        elif op == '-':
            expected = a - b
        elif op in ['*', 'x', '×']:
            expected = a * b
        elif op in ['/', '÷']:
            if b != 0:
                expected = a / b
            else:
                return None
        else:
            return None
        if abs(ans - expected) > 0.01:
            return f"Math mismatch in '{q[:50]}': expected {expected}, got {ans}"
        return None

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
                # Check questions array
                for q in data.get('questions', []):
                    total += 1
                    qt = q.get('question_text_en', '') or q.get('question_text', '') or q.get('question_text_th', '') or q.get('question_en', '') or q.get('question_th', '')
                    ans = q.get('correct_answer', '') or q.get('answer', '')
                    exp = q.get('explanation_en', '') or q.get('explanation', '') or q.get('explanation_th', '')
                    issue = verify_question(qt, ans, exp)
                    if issue:
                        issues.append((str(fp), issue))

                # Check mini_quiz in visual_blocks
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
    print("=== MATH VERIFICATION ===")
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
