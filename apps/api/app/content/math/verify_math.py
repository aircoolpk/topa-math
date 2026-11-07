#!/usr/bin/env python3
"""Verify math correctness in TOPA Math content files."""
import json
import re
from pathlib import Path

# Patterns to extract math expressions
ADD_RE = re.compile(r'(\d+)\s*\+\s*(\d+)')
SUB_RE = re.compile(r'(\d+)\s*-\s*(\d+)')
MUL_RE = re.compile(r'(\d+)\s*[\*x×]\s*(\d+)')
DIV_RE = re.compile(r'(\d+)\s*[÷/]\s*(\d+)')
NUM_RE = re.compile(r'\b(\d+(?:,\d{3})*(?:\.\d+)?)\b')

def parse_num(s):
    return float(s.replace(',', ''))

def extract_answer(text):
    """Extract the numeric answer from a string like '13 marbles'."""
    nums = NUM_RE.findall(str(text))
    if not nums:
        return None
    return parse_num(nums[0])

def verify_question(obj):
    """Try to verify the math in a question. Returns issue string or None."""
    q = obj.get('question_text_en') or obj.get('question_text_th') or obj.get('question', '')
    if not q:
        return None
    answer = obj.get('correct_answer', '')
    if not answer:
        return None

    q_str = str(q)
    ans_num = extract_answer(answer)

    # Skip if no number in answer
    if ans_num is None:
        return None

    # Try to find and verify basic operations
    # Addition
    add_match = ADD_RE.search(q_str)
    sub_match = SUB_RE.search(q_str)
    mul_match = MUL_RE.search(q_str)
    div_match = DIV_RE.search(q_str)

    # If we find explicit equation like "5+3=?"
    eq_match = re.search(r'(\d+)\s*([+\-*/×÷])\s*(\d+)\s*=\s*\?', q_str)
    if eq_match:
        a, op, b = eq_match.group(1), eq_match.group(2), eq_match.group(3)
        a_n, b_n = int(a), int(b)
        if op == '+':
            expected = a_n + b_n
        elif op == '-':
            expected = a_n - b_n
        elif op in ['*', 'x', '×']:
            expected = a_n * b_n
        elif op in ['/', '÷']:
            if b_n != 0:
                expected = a_n / b_n
            else:
                return None
        else:
            return None
        if abs(ans_num - expected) > 0.01:
            return f"Q '{q[:60]}' expected {expected} but answer is {ans_num}"
        return None

    return None  # No verification possible

def main():
    base = Path('apps/api/app/content/math/question_banks')
    total_q = 0
    issues = []

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
                    total_q += 1
                    issue = verify_question(obj)
                    if issue:
                        issues.append((str(fp), i, issue))

    print(f"=== MATH VERIFICATION REPORT ===")
    print(f"Total questions checked: {total_q}")
    print(f"Math issues found: {len(issues)}")
    print()
    for fp, i, iss in issues[:50]:
        print(f"{fp}:{i}: {iss}")

if __name__ == '__main__':
    main()
