#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')
lines = src.split('\n')

# Current structure (lines are 1-indexed):
# 1-110: helpers (mkq, save_jsonl, etc.)
# 123-642: gen_g1_* and gen_g2_* functions (14 functions)
# 654-673: TOPICS dict (grades 1-2)
# 674: blank
# 675-690: GEN_MAP dict (references gen_g2_time_calendar at line 688)
# 691-692: blank
# 693-724: gen_g2_time_calendar (DUPLICATE - function already defined at line 674!)
# 725-757: gen_g2_shapes_2d (DUPLICATE - function already defined at line 706!)
# 758-768: if __name__ block

# PROBLEM: Two copies of each function. Python uses the SECOND definition (line 693, 725).
# But when GEN_MAP is built (line 688), Python uses the name lookup.
# At line 688, only the FIRST definition (line 674) has been seen by the interpreter.
# Wait - if there are TWO definitions, Python would raise a NameError for the SECOND
# being undefined at the time of first reference... but actually Python uses the LAST
# definition in the file when looking up names at runtime.

# Actually let me just REWRITE the file completely:
# 1. Helpers
# 2. TOPICS dict
# 3. GEN_MAP dict  
# 4. All 14 generator functions (in order)
# 5. if __name__ block

# Keep lines 1-110 (helpers: ri, wrong_opts, make_choices, mkq, save_jsonl)
# Keep lines 654-673 (TOPICS dict - this is at correct position)
# Keep lines 675-690 (GEN_MAP dict - this references all 14 functions)
# Keep lines 758-768 (if __name__ block)
# Keep lines 123-642 (the 12 original gen_g1_* and gen_g2_* function definitions)
# But we need to place gen_g2_time_calendar and gen_g2_shapes_2d AFTER the GEN_MAP

# The simplest fix: 
# - Remove the duplicate functions at lines 693-724 and 725-757
# - Keep only the original functions at lines 123-642

# Let's identify which lines to remove
# From debug output: 
# - gen_g2_time_calendar at line 693 (index 692)
# - gen_g2_shapes_2d at line 725 (index 724)
# - if __name__ at line 758 (index 757)

# We want to keep lines 0-690 (up to and including '}' closing GEN_MAP at line 690)
# Then skip lines 692-756 (the duplicate function bodies and blank lines)
# Then keep lines 757 onwards (the if __name__ block)

new_lines = lines[:690] + lines[757:]
print('Original: {} lines, New: {} lines'.format(len(lines), len(new_lines)))

new_src = '\n'.join(new_lines)
path.write_text(new_src, encoding='utf-8')
print('Written. New length: {}'.format(len(new_src)))

import ast
try:
    ast.parse(new_src)
    print('Syntax OK')
except SyntaxError as e:
    print('SyntaxError at line {}: {}'.format(e.lineno, e.msg))