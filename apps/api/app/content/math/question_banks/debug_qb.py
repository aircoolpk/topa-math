#!/usr/bin/env python3
import sys, pathlib, json

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')
lines = src.split('\n')

output = []
output.append(f'Total lines: {len(src)}')
output.append(f'File size: {len(src)} bytes')

# Check scope of gen_g2_time_calendar
import ast
tree = ast.parse(src)
funcs = {}
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name.startswith('gen_g'):
        funcs[node.name] = (node.lineno, node.col_offset)

output.append('\nAll gen_* functions:')
for name in sorted(funcs.keys()):
    lineno, col = funcs[name]
    output.append(f'  {name}: line {lineno}, col {col}')

output.append(f'\ngen_g2_time_calendar at line {funcs["gen_g2_time_calendar"][0]}')
output.append(f'gen_g2_shapes_2d at line {funcs["gen_g2_shapes_2d"][0]}')

# Check if gen_g2_time_calendar is defined at module level (col_offset 0)
for name, (ln, col) in funcs.items():
    if col != 0:
        output.append(f'WARNING: {name} has col_offset {col} (may be nested!)')

# Look at what's before line 688
output.append('\nLines 680-695:')
for i in range(679, 695):
    line = lines[i]
    try:
        display = line.encode('ascii', replace='?').decode('ascii')[:100]
    except:
        display = '[ Thai characters ]'
    output.append(f'{i+1}: {display}')

outpath = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\debug_output.txt')
outpath.write_text('\n'.join(output), encoding='utf-8')
print('Written to', outpath)
print('Content:')
print('\n'.join(output))