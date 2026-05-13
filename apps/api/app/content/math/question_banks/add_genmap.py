#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')

# Check the GEN_MAP from the working version of generate_qb.py
# We need to add:
# GEN_MAP = {
#     'g1_counting_20': gen_g1_counting_20,
#     ...all 14 entries...
# }
# After line 673 (the '}' that closes TOPICS dict) and before line 674 (def gen_g2_time_calendar)

# Find line 673 (the '}' that closes TOPICS)
# Line 673 has '}' and line 674 has 'def gen_g2_time_calendar'

lines = src.split('\n')
# We know:
# - Line 673 (index 672): '}' closing TOPICS
# - Line 674 (index 673): def gen_g2_time_calendar

# Build the GEN_MAP dict
gen_map_entries = [
    "'g1_counting_20': gen_g1_counting_20",
    "'g1_add_one_digit': gen_g1_add_one_digit",
    "'g1_subtract_one_digit': gen_g1_subtract_one_digit",
    "'g1_compare_numbers': gen_g1_compare_numbers",
    "'g1_number_order': gen_g1_number_order",
    "'g1_shapes_2d_basic': gen_g1_shapes_2d_basic",
    "'g1_position_direction': gen_g1_position_direction",
    "'g2_add_two_digit': gen_g2_add_two_digit",
    "'g2_subtract_two_digit': gen_g2_subtract_two_digit",
    "'g2_multiplication_intro': gen_g2_multiplication_intro",
    "'g2_times_table_2_5_10': gen_g2_times_table_2_5_10",
    "'g2_money_change': gen_g2_money_change",
    "'g2_time_calendar': gen_g2_time_calendar",
    "'g2_shapes_2d': gen_g2_shapes_2d",
]

gen_map_block = '\nGEN_MAP = {\n    ' + ',\n    '.join(gen_map_entries) + ',\n}\n\n'

# Insert after line 673 (index 672 = '}')
new_lines = lines[:673] + [gen_map_block] + lines[673:]
new_src = '\n'.join(new_lines)

print('New file: {} lines (was {})'.format(len(new_lines), len(lines)))

path.write_text(new_src, encoding='utf-8')
print('Written. New length: {}'.format(len(new_src)))

# Verify
import ast
try:
    ast.parse(new_src)
    print('Syntax OK')
except SyntaxError as e:
    print('SyntaxError at line {}: {}'.format(e.lineno, e.msg))