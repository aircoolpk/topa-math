#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyze generate_qb.py structure"""
src = open(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py', encoding='utf-8').read()
lines = src.split('\n')

# Find all function definitions
print("=== ALL FUNCTION DEFINITIONS ===")
for i, line in enumerate(lines):
    if line.startswith('def gen_'):
        print(f"Line {i+1}: {line.strip()}")

print()
print("=== GEN_MAP occurrences ===")
for i, line in enumerate(lines):
    if 'GEN_MAP' in line:
        print(f"Line {i+1}: {line.strip()[:80]}")

print()
print("=== if __name__ occurrences ===")
for i, line in enumerate(lines):
    if '__name__' in line:
        print(f"Line {i+1}: {line.strip()}")

print()
print("=== TOPICS occurrences ===")
for i, line in enumerate(lines):
    if 'TOPICS' in line and '=' in line:
        print(f"Line {i+1}: {line.strip()[:80]}")

# Show lines around the two duplicate defs
print()
print("=== Lines 736-775 (around first duplicate funcs) ===")
for i in range(735, 775):
    print(f"{i+1}: {lines[i].rstrip()[:100]}")

print()
print("=== Lines 820-860 (around second duplicate funcs) ===")
for i in range(819, 859):
    print(f"{i+1}: {lines[i].rstrip()[:100]}")