#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Move gen_g2_time_calendar and gen_g2_shapes_2d definitions BEFORE the GEN_MAP dict"""
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')
lines = src.split('\n')
print(f'File: {len(lines)} lines')

# gen_g2_time_calendar is at line 694, gen_g2_shapes_2d at line 726
# GEN_MAP dict is at lines 675-690
# We need to move the two function definitions to before line 675

# Find the functions to move (lines are 1-indexed, Python is 0-indexed)
time_cal_start = None  # line 694 (1-indexed)
shapes_2d_start = None  # line 726

for i, line in enumerate(lines):
    if line.strip() == 'def gen_g2_time_calendar(tc, skill):':
        time_cal_start = i + 1
    if line.strip() == 'def gen_g2_shapes_2d(tc, skill):':
        shapes_2d_start = i + 1

print(f'gen_g2_time_calendar at line {time_cal_start}')
print(f'gen_g2_shapes_2d at line {shapes_2d_start}')

# Find where each function ends (next def or end of file)
# gen_g2_time_calendar ends at line before gen_g2_shapes_2d or before any other 'def '
# gen_g2_shapes_2d ends at end of file or next 'def '

all_defs = []
for i, line in enumerate(lines):
    if line.strip().startswith('def gen_'):
        all_defs.append((i + 1, line.strip()))

print('\nAll def lines:')
for ln, code in all_defs:
    print(f'  {ln}: {code}')

# Find end of gen_g2_shapes_2d
shapes_end = len(lines)  # default: end of file
for i, line in enumerate(lines):
    if i > shapes_2d_start and line.strip().startswith('def '):
        shapes_end = i  # exclusive end
        break

# Find end of gen_g2_time_calendar
time_cal_end = shapes_2d_start  # default: starts where shapes_2d starts
for i, line in enumerate(lines):
    if i > time_cal_start and line.strip().startswith('def gen_g2_shapes_2d'):
        time_cal_end = i
        break

print(f'\ngen_g2_time_calendar: lines {time_cal_start}-{time_cal_end}')
print(f'gen_g2_shapes_2d: lines {shapes_2d_start}-{shapes_end}')

# Build new file
# Keep: lines 1 to (time_cal_start-1) = lines 1 to 693
# Then insert the two functions
# Then skip: lines time_cal_start to shapes_end-1 = original function bodies
# Then keep: lines shapes_end to end = the GEN_MAP and main block

# Line numbers (1-indexed):
# Keep: 1-693 (before gen_g2_time_calendar)
# Insert: 694-726 (time_calendar func) + 727-shapes_end (shapes_2d func)  
# Skip: 694 to shapes_end-1 (original location of funcs)
# Keep: shapes_end to end (the second occurrence block with GEN_MAP and main)

# Actually let's just identify the main block more clearly
# The main block (TOPICS dict #2 + GEN_MAP dict #2 + if __name__) is at lines 697-end
# But we want to KEEP that and SKIP the first occurrence (lines 675-696)

# The problem is:
# - Lines 675-690: GEN_MAP dict #1 (BROKEN - references funcs before def)
# - Lines 697-end: GEN_MAP dict #2 (CORRECT - proper entries)
# - Lines 694-725: gen_g2_time_calendar and gen_g2_shapes_2d (function bodies)

# Solution: 
# 1. Keep lines 1-674
# 2. Insert gen_g2_time_calendar (line 694) and gen_g2_shapes_2d (line 727)  
# 3. Skip original lines 694-726 (functions at original location)
# 4. Keep lines 727-end (the second TOPICS/GEN_MAP/main block)

# In 0-indexed:
# keep_1 = lines[0:673]  (1-673)
# insert_funcs = lines[693:726]  (694-726, both functions)
# skip = lines[693:726]  (same, skip original location)
# keep_2 = lines[726:]  (727-end, main block)

new_lines = lines[:673] + lines[693:726] + lines[726:]
print(f'\nNew file: {len(new_lines)} lines')
print(f'Original: {len(lines)} lines')

new_src = '\n'.join(new_lines)
outpath = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
outpath.write_text(new_src, encoding='utf-8')
print(f'Written. New length: {len(new_src)}')

# Verify
import ast
try:
    ast.parse(new_src)
    print('Syntax OK')
except SyntaxError as e:
    print(f'SyntaxError at line {e.lineno}: {e.msg}')