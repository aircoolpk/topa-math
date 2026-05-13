#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')
lines = src.split('\n')

print('Total lines: {}'.format(len(lines)))

# Find if __name__ block
if_name_idx = None
for i, line in enumerate(lines):
    if '__name__' in line and '==' in line:
        if_name_idx = i
        break

print('if __name__ at line {}'.format(if_name_idx + 1 if if_name_idx else 'NOT FOUND'))

# Find gen_g2_time_calendar (should be at line 693, index 692)
gen_tc_idx = None
for i, line in enumerate(lines):
    if 'def gen_g2_time_calendar' in line:
        gen_tc_idx = i
        break

print('gen_g2_time_calendar at line {}'.format(gen_tc_idx + 1))

# The functions to move are from gen_tc_idx to if_name_idx - 1
# We want to keep:
# - lines[0:653] = up to line 653 (before TOPICS dict at 654)
# - lines[gen_tc_idx:if_name_idx] = the two functions
# - lines[if_name_idx:] = the if __name__ block
# But we also need to keep lines[654:gen_tc_idx] (TOPICS + GEN_MAP)

# Actually the simplest:
# - Remove lines[gen_tc_idx:if_name_idx] (the two functions from current position)
# - Insert them right after line 653 (before TOPICS dict at 654)

func_block = lines[gen_tc_idx:if_name_idx]
print('Function block: {} lines (from line {} to {})'.format(len(func_block), gen_tc_idx+1, if_name_idx))

# New structure:
# lines[0:653] + func_block + lines[653:gen_tc_idx] + lines[if_name_idx:]
# = up to line 653 + functions + (TOPICS + GEN_MAP) + if __name__

new_lines = lines[:653] + func_block + lines[653:gen_tc_idx] + lines[if_name_idx:]
print('New file: {} lines'.format(len(new_lines)))

new_src = '\n'.join(new_lines)
path.write_text(new_src, encoding='utf-8')
print('Written. New length: {}'.format(len(new_src)))

import ast
try:
    ast.parse(new_src)
    print('Syntax OK')
except SyntaxError as e:
    print('SyntaxError at line {}: {}'.format(e.lineno, e.msg))