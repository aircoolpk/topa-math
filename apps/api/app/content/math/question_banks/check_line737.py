#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')

lines = src.split('\n')
print(f'Total lines: {len(lines)}')

# Find all 'def gen_g' with context
print('\nAll def gen_g lines:')
for i, line in enumerate(lines):
    if line.strip().startswith('def gen_g'):
        print(f'  Line {i+1}: {repr(line.strip()[:60])}')

# Check around line 770-780
print('\nLines 768-780:')
for i in range(767, 780):
    if i < len(lines):
        print(f'  {i+1}: {repr(lines[i][:80])}')

print('\nLines 818-825:')
for i in range(817, 825):
    if i < len(lines):
        print(f'  {i+1}: {repr(lines[i][:80])}')

print('\nLines 851-858:')
for i in range(850, 858):
    if i < len(lines):
        print(f'  {i+1}: {repr(lines[i][:80])}')