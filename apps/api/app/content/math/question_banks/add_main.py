#!/usr/bin/env python3
import pathlib, ast

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')

print('File has {} lines, {} bytes'.format(len(src.split('\n')), len(src)))

# Check if __name__ exists
if '__name__' in src:
    print('__name__ block EXISTS')
else:
    print('__name__ block MISSING - adding it')

# Add the main block
main_block = '''

if __name__ == '__main__':
    total = 0
    for g, topics in sorted(TOPICS.items()):
        for tc, name, skill in topics:
            print('Generating grade {} {}...'.format(g, tc))
            gen_fn = GEN_MAP.get(tc)
            if gen_fn:
                qs = gen_fn(tc, skill)
                save_jsonl(tc, qs)
                total += len(qs)
            else:
                print('  WARNING: no generator for {}'.format(tc))
    print('Total: {} questions written.'.format(total))
    print('Done.')
'''

new_src = src + main_block
path.write_text(new_src, encoding='utf-8')
print('Written. New length: {}'.format(len(new_src)))

# Verify
try:
    ast.parse(new_src)
    print('Syntax OK')
except SyntaxError as e:
    print('SyntaxError at line {}: {}'.format(e.lineno, e.msg))