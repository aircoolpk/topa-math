#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Remove duplicate generator functions from generate_qb.py"""
src = open(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py', encoding='utf-8').read()

first_time_cal = src.find('def gen_g2_time_calendar(tc, skill):')
first_shapes = src.find('def gen_g2_shapes_2d(tc, skill):')
second_time_cal = src.find('def gen_g2_time_calendar(tc, skill):', first_time_cal + 1)
second_shapes = src.find('def gen_g2_shapes_2d(tc, skill):', first_shapes + 1)

print(f"First time_calendar at char {first_time_cal}")
print(f"First shapes_2d at char {first_shapes}")
print(f"Second time_calendar at char {second_time_cal}")
print(f"Second shapes_2d at char {second_shapes}")

# Remove the first occurrence block (from first_time_cal to second_time_cal)
new_src = src[:first_time_cal] + src[second_time_cal:]

outpath = r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py'
open(outpath, 'w', encoding='utf-8').write(new_src)
print(f'Written. New length: {len(new_src)}')

# Verify syntax
import ast
try:
    ast.parse(new_src)
    print("Syntax OK")
except SyntaxError as e:
    print(f"SyntaxError at line {e.lineno}: {e.msg}")