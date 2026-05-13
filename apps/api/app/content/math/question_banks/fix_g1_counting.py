#!/usr/bin/env python3
"""Fix gen_g1_counting_20: enumerate unpacks 7 items but loop only expects 6"""
import pathlib, re

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')

# The bug: for i, (a, q, e, h, s, m) in enumerate([...], 1):
# But each tuple has 7 items and the mkq call hardcodes cwr
# Fix: change to for i, (a, q, e, h, s, m, cwr) in enumerate([...], 1):
# and change mkq call to pass cwr instead of hardcoded string

# Count occurrences
count = src.count('for i, (a, q, e, h, s, m) in enumerate')
print('Found {} occurrences of the buggy loop pattern'.format(count))

# Replace the pattern
fixed = src.replace('for i, (a, q, e, h, s, m) in enumerate', 'for i, (a, q, e, h, s, m, cwr) in enumerate')

# Also need to update the mkq call to use cwr variable instead of hardcoded string
# The hardcoded string is: 'นับเลขผิดหรือจำลำดับผิด'
old_mkq = "'นับเลขผิดหรือจำลำดับผิด', 'core', 'routine', 'easy', 'build_confidence', i))"
new_mkq = "cwr, 'core', 'routine', 'easy', 'build_confidence', i))"
fixed = fixed.replace(old_mkq, new_mkq)

print('Replacements made')

path.write_text(fixed, encoding='utf-8')
print('Written')

# Verify syntax
import ast
try:
    ast.parse(fixed)
    print('Syntax OK')
except SyntaxError as e:
    print('SyntaxError at line {}: {}'.format(e.lineno, e.msg))