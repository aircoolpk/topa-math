#!/usr/bin/env python3
import ast, pathlib, json
src = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py').read_text(encoding='utf-8')
tree = ast.parse(src)
funcs = sorted(n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name.startswith('gen_g'))
print('gen_g functions:', funcs)
print()

missing = []
for g, topics in [
    (1, [('g1_counting_20',), ('g1_add_one_digit',), ('g1_subtract_one_digit',),
         ('g1_compare_numbers',), ('g1_number_order',), ('g1_shapes_2d_basic',), ('g1_position_direction',)]),
    (2, [('g2_add_two_digit',), ('g2_subtract_two_digit',), ('g2_multiplication_intro',),
         ('g2_times_table_2_5_10',), ('g2_money_change',), ('g2_time_calendar',), ('g2_shapes_2d',)]),
]:
    for (tc,) in topics:
        fn = f'gen_{tc}'
        status = 'DEFINED' if fn in funcs else 'MISSING'
        print(f'  g={g} {tc}: {status}')
        if status == 'MISSING':
            missing.append((g, tc))

print()
print('=== GRADE FILE STATUS ===')
base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
for g in [1,2,3,4,5,6]:
    d = base / f'grade_{g}'
    if d.exists():
        files = sorted(d.glob('*.jsonl'))
        total = sum(sum(1 for _ in open(f, encoding='utf-8')) for f in files)
        print(f'Grade {g}: {len(files)} files, {total} total lines')
        for f in files:
            lines = sum(1 for _ in open(f, encoding='utf-8'))
            # Check first question schema
            try:
                q = json.loads(next(open(f, encoding='utf-8')))
                has_new = 'routine_level' in q
                qt = q.get('question_type','?')
                print(f'  {f.name}: {lines}L qtype={qt} new_schema={has_new}')
            except:
                print(f'  {f.name}: {lines}L [parse error]')
    else:
        print(f'Grade {g}: directory not found')
